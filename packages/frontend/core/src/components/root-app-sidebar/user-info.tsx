import {
  Avatar,
  Button,
  Divider,
  Menu,
  MenuIcon,
  MenuItem,
} from '@affine/component';
import { openSettingModalAtom, openSignOutModalAtom } from '@affine/core/atoms';
import {
  useCurrentUser,
  useSession,
} from '@affine/core/hooks/affine/use-current-user';
import { useAFFiNEI18N } from '@affine/i18n/hooks';
import { AccountIcon, SignOutIcon } from '@blocksuite/icons';
import { cssVar } from '@toeverything/theme';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

import { SignInItem } from '../pure/workspace-slider-bar/user-with-workspace-list';
import * as styles from './index.css';

export const UserInfo = () => {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  return isAuthenticated ? <AuthorizedUserInfo /> : <UnauthorizedUserInfo />;
};

const AuthorizedUserInfo = () => {
  const user = useCurrentUser();
  return (
    <Menu items={<OperationMenu />}>
      <Button type="plain" className={styles.userInfoWrapper}>
        <Avatar size={20} name={user.name} url={user.avatarUrl} />
      </Button>
    </Menu>
  );
};

const UnauthorizedUserInfo = () => {
  return (
    <Menu items={<SignInItem />}>
      <Button type="plain" className={styles.userInfoWrapper}>
        <Avatar
          style={{ color: cssVar('black') }}
          size={20}
          url={'/imgs/unknown-user.svg'}
        />
      </Button>
    </Menu>
  );
};

const AccountMenu = () => {
  const setSettingModalAtom = useSetAtom(openSettingModalAtom);
  const setOpenSignOutModalAtom = useSetAtom(openSignOutModalAtom);

  const onOpenAccountSetting = useCallback(() => {
    setSettingModalAtom(prev => ({
      ...prev,
      open: true,
      activeTab: 'account',
    }));
  }, [setSettingModalAtom]);

  const onOpenSignOutModal = useCallback(() => {
    setOpenSignOutModalAtom(true);
  }, [setOpenSignOutModalAtom]);

  const t = useAFFiNEI18N();

  return (
    <>
      <MenuItem
        preFix={
          <MenuIcon>
            <AccountIcon />
          </MenuIcon>
        }
        data-testid="workspace-modal-account-settings-option"
        onClick={onOpenAccountSetting}
      >
        {t['com.affine.workspace.cloud.account.settings']()}
      </MenuItem>
      <Divider />
      <MenuItem
        preFix={
          <MenuIcon>
            <SignOutIcon />
          </MenuIcon>
        }
        data-testid="workspace-modal-sign-out-option"
        onClick={onOpenSignOutModal}
      >
        {t['com.affine.workspace.cloud.account.logout']()}
      </MenuItem>
    </>
  );
};

const OperationMenu = () => {
  // TODO: display usage progress bar
  const StorageUsage = null;

  return (
    <>
      {StorageUsage}
      <AccountMenu />
    </>
  );
};
