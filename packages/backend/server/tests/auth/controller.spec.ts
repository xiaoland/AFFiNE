import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import ava, { TestFn } from 'ava';

import { AuthModule, CurrentUser } from '../../src/core/auth';
import { AuthService } from '../../src/core/auth/service';
import { FeatureModule } from '../../src/core/features';
import { UserModule, UserService } from '../../src/core/user';
import { createTestingApp } from '../utils';

const test = ava as TestFn<{
  auth: AuthService;
  user: UserService;
  u1: CurrentUser;
  db: PrismaClient;
  app: INestApplication;
}>;

test.beforeEach(async t => {
  const { app } = await createTestingApp({
    imports: [FeatureModule, UserModule, AuthModule],
  });

  t.context.auth = app.get(AuthService);
  t.context.user = app.get(UserService);
  t.context.db = app.get(PrismaClient);
  t.context.app = app;

  t.context.u1 = await t.context.auth.signUp('u1', 'u1@affine.pro', '1');
});

test.afterEach.always(async t => {
  await t.context.app.close();
});

test('should', t => {
  t.true(true);
});
