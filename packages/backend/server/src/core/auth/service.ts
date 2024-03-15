import {
  BadRequestException,
  Injectable,
  NotAcceptableException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaClient, type User } from '@prisma/client';
import type { CookieOptions, Request, Response } from 'express';
import { assign, omit } from 'lodash-es';

import {
  Config,
  CryptoHelper,
  MailService,
  SessionCache,
} from '../../fundamentals';
import { FeatureManagementService } from '../features/management';
import { UserService } from '../user/service';
import type { CurrentUser } from './current-user';

export function parseAuthUserSeqNum(value: any) {
  let seq: number = 0;
  switch (typeof value) {
    case 'number': {
      seq = value;
      break;
    }
    case 'string': {
      const result = value.match(/^([\d{0, 10}])$/);
      if (result?.[1]) {
        seq = Number(result[1]);
      }
      break;
    }

    default: {
      seq = 0;
    }
  }

  return Math.max(0, seq);
}

export function sessionUser(
  user: Pick<
    User,
    'id' | 'email' | 'avatarUrl' | 'name' | 'emailVerifiedAt'
  > & { password?: string | null }
): CurrentUser {
  return assign(
    omit(user, 'password', 'registered', 'emailVerifiedAt', 'createdAt'),
    {
      hasPassword: user.password !== null,
      emailVerified: user.emailVerifiedAt !== null,
    }
  );
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  readonly cookieOptions: CookieOptions = {
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
    domain: this.config.host,
    secure: this.config.https,
  };
  static readonly sessionCookieName = 'sid';
  static readonly authUserSeqHeaderName = 'x-auth-user';

  constructor(
    private readonly config: Config,
    private readonly db: PrismaClient,
    private readonly mailer: MailService,
    private readonly feature: FeatureManagementService,
    private readonly user: UserService,
    private readonly crypto: CryptoHelper,
    private readonly cache: SessionCache
  ) {}

  async onApplicationBootstrap() {
    if (this.config.node.dev) {
      await this.signUp('Dev User', 'dev@affine.pro', 'dev').catch(() => {
        // ignore
      });
    }
  }

  canSignIn(email: string) {
    return this.feature.canEarlyAccess(email);
  }

  async signUp(
    name: string,
    email: string,
    password: string
  ): Promise<CurrentUser> {
    const user = await this.user.findUserByEmail(email);

    if (user) {
      throw new BadRequestException('Email was taken');
    }

    const hashedPassword = await this.crypto.encryptPassword(password);

    return this.user
      .createUser({
        name,
        email,
        password: hashedPassword,
      })
      .then(sessionUser);
  }

  async signIn(email: string, password: string) {
    const user = await this.user.findUserWithHashedPasswordByEmail(email);

    if (!user) {
      throw new NotAcceptableException('Invalid sign in credentials');
    }

    if (!user.password) {
      throw new NotAcceptableException(
        'User Password is not set. Should login through email link.'
      );
    }

    const passwordMatches = await this.crypto.verifyPassword(
      password,
      user.password
    );

    if (!passwordMatches) {
      throw new NotAcceptableException('Invalid sign in credentials');
    }

    return sessionUser(user);
  }

  async getUser(token: string, seq = 0) {
    const cacheKey = `session:${token}`;
    let user = await this.cache.mapGet<CurrentUser | null>(
      cacheKey,
      String(seq)
    );
    if (user) {
      return user;
    }

    user = await this.getUserFromDB(token, seq);

    if (user) {
      await this.cache.mapSet(cacheKey, String(seq), user);
    }

    return user;
  }

  async getUserFromDB(token: string, seq = 0): Promise<CurrentUser | null> {
    const session = await this.getSession(token);

    // no such session
    if (!session) {
      return null;
    }

    const userSession = session.userSessions.at(seq);

    // no such user session
    if (!userSession) {
      return null;
    }

    // user session expired
    if (userSession.expiresAt && userSession.expiresAt <= new Date()) {
      return null;
    }

    const user = await this.db.user.findUnique({
      where: { id: userSession.userId },
    });

    if (!user) {
      return null;
    }

    return sessionUser(user);
  }

  async getUserList(token: string) {
    const session = await this.getSession(token);

    if (!session || !session.userSessions.length) {
      return [];
    }

    const users = await this.db.user.findMany({
      where: {
        id: {
          in: session.userSessions.map(({ userId }) => userId),
        },
      },
    });

    // TODO(@forehalo): need to separate expired session, same for [getUser]
    // Session
    //   | { user: LimitedUser { email, avatarUrl }, expired: true }
    //   | { user: User, expired: false }
    return session.userSessions
      .map(userSession => {
        // keep users in the same order as userSessions
        const user = users.find(({ id }) => id === userSession.userId);
        if (!user) {
          return null;
        }
        return sessionUser(user);
      })
      .filter(Boolean) as CurrentUser[];
  }

  async signOut(token: string, seq = 0) {
    const session = await this.getSession(token);

    if (session) {
      // overflow the logged in user
      if (session.userSessions.length <= seq) {
        return session;
      }

      await this.cache.delete(`session:${token}`);

      await this.db.userSession.deleteMany({
        where: { id: session.userSessions[seq].id },
      });

      // no more user session active, delete the whole session
      if (session.userSessions.length === 1) {
        await this.db.session.delete({ where: { id: session.id } });
        return null;
      }

      return session;
    }

    return null;
  }

  async getSession(token: string) {
    return this.db.$transaction(async tx => {
      const session = await tx.session.findUnique({
        where: {
          id: token,
        },
        include: {
          userSessions: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!session) {
        return null;
      }

      if (session.expiresAt && session.expiresAt <= new Date()) {
        await tx.session.delete({
          where: {
            id: session.id,
          },
        });

        return null;
      }

      return session;
    });
  }

  async createUserSession(
    user: { id: string },
    existingSession?: string,
    ttl = this.config.auth.session.ttl
  ) {
    const session = existingSession
      ? await this.getSession(existingSession)
      : null;

    const expiresAt = new Date(Date.now() + ttl * 1000);
    if (session) {
      return this.db.userSession.upsert({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId: user.id,
          },
        },
        update: {
          expiresAt,
        },
        create: {
          sessionId: session.id,
          userId: user.id,
          expiresAt,
        },
      });
    } else {
      return this.db.userSession.create({
        data: {
          expiresAt,
          session: {
            create: {},
          },
          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });
    }
  }

  async setCookie(req: Request, res: Response, user: { id: string }) {
    const session = await this.createUserSession(
      user,
      req.cookies[AuthService.sessionCookieName]
    );

    res.cookie(AuthService.sessionCookieName, session.sessionId, {
      expires: session.expiresAt ?? void 0,
      ...this.cookieOptions,
    });
  }

  async changePassword(id: string, newPassword: string): Promise<User> {
    const user = await this.user.findUserById(id);

    if (!user) {
      throw new BadRequestException('Invalid email');
    }

    const hashedPassword = await this.crypto.encryptPassword(newPassword);

    return this.db.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  async changeEmail(id: string, newEmail: string): Promise<User> {
    const user = await this.user.findUserById(id);

    if (!user) {
      throw new BadRequestException('Invalid email');
    }

    return this.db.user.update({
      where: {
        id,
      },
      data: {
        email: newEmail,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async setEmailVerified(id: string) {
    return await this.db.user.update({
      where: {
        id,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
      select: {
        emailVerifiedAt: true,
      },
    });
  }

  async sendChangePasswordEmail(email: string, callbackUrl: string) {
    return this.mailer.sendChangePasswordEmail(email, callbackUrl);
  }
  async sendSetPasswordEmail(email: string, callbackUrl: string) {
    return this.mailer.sendSetPasswordEmail(email, callbackUrl);
  }
  async sendChangeEmail(email: string, callbackUrl: string) {
    return this.mailer.sendChangeEmail(email, callbackUrl);
  }
  async sendVerifyChangeEmail(email: string, callbackUrl: string) {
    return this.mailer.sendVerifyChangeEmail(email, callbackUrl);
  }
  async sendVerifyEmail(email: string, callbackUrl: string) {
    return this.mailer.sendVerifyEmail(email, callbackUrl);
  }
  async sendNotificationChangeEmail(email: string) {
    return this.mailer.sendNotificationChangeEmail(email);
  }

  async sendSignInEmail(email: string, link: string, signUp: boolean) {
    return signUp
      ? await this.mailer.sendSignUpMail(link.toString(), {
          to: email,
        })
      : await this.mailer.sendSignInMail(link.toString(), {
          to: email,
        });
  }
}
