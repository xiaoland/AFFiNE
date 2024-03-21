import { Tooltip } from '@affine/component';
import { pushNotificationAtom } from '@affine/component/notification-center';
import { Avatar, type AvatarProps } from '@affine/component/ui/avatar';
import { Loading } from '@affine/component/ui/loading';
import { openSettingModalAtom } from '@affine/core/atoms';
import { useIsWorkspaceOwner } from '@affine/core/hooks/affine/use-is-workspace-owner';
import { useSyncEngineStatus } from '@affine/core/hooks/affine/use-sync-engine-status';
import { useWorkspaceBlobObjectUrl } from '@affine/core/hooks/use-workspace-blob';
import { useWorkspaceInfo } from '@affine/core/hooks/use-workspace-info';
import { UNTITLED_WORKSPACE_NAME } from '@affine/env/constant';
import { WorkspaceFlavour } from '@affine/env/workspace';
import { useAFFiNEI18N } from '@affine/i18n/hooks';
import {
  CloudWorkspaceIcon,
  InformationFillDuotoneIcon,
  LocalWorkspaceIcon,
  NoNetworkIcon,
  UnsyncIcon,
} from '@blocksuite/icons';
import { SyncEngineStep, Workspace } from '@toeverything/infra';
import { useService } from '@toeverything/infra/di';
import { useSetAtom } from 'jotai';
import { debounce } from 'lodash-es';
import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useSystemOnline } from '../../../../hooks/use-system-online';
import * as styles from './styles.css';

// FIXME:
// 2. Refactor the code to improve readability
const CloudWorkspaceStatus = () => {
  return (
    <>
      <CloudWorkspaceIcon />
      Cloud
    </>
  );
};

const SyncingWorkspaceStatus = ({ progress }: { progress?: number }) => {
  return (
    <>
      <Loading progress={progress} speed={progress ? 0 : undefined} />
      Syncing...
    </>
  );
};

const UnSyncWorkspaceStatus = () => {
  return (
    <>
      <UnsyncIcon />
      Wait for upload
    </>
  );
};

const LocalWorkspaceStatus = () => {
  return (
    <>
      {!environment.isDesktop ? (
        <InformationFillDuotoneIcon data-warning-color="true" />
      ) : (
        <LocalWorkspaceIcon />
      )}
      Local
    </>
  );
};

const OfflineStatus = () => {
  return (
    <>
      <NoNetworkIcon />
      Offline
    </>
  );
};

const useSyncEngineSyncProgress = () => {
  const t = useAFFiNEI18N();
  const isOnline = useSystemOnline();
  const pushNotification = useSetAtom(pushNotificationAtom);
  const { syncEngineStatus, setSyncEngineStatus, progress } =
    useSyncEngineStatus();
  const [isOverCapacity, setIsOverCapacity] = useState(false);

  const currentWorkspace = useService(Workspace);
  const isOwner = useIsWorkspaceOwner(currentWorkspace.meta);

  const setSettingModalAtom = useSetAtom(openSettingModalAtom);
  const jumpToPricePlan = useCallback(async () => {
    setSettingModalAtom({
      open: true,
      activeTab: 'plans',
    });
  }, [setSettingModalAtom]);

  // debounce sync engine status
  useEffect(() => {
    setSyncEngineStatus(currentWorkspace.engine.sync.status);
    const disposable = currentWorkspace.engine.sync.onStatusChange.on(
      debounce(
        status => {
          setSyncEngineStatus(status);
        },
        300,
        {
          maxWait: 500,
          trailing: true,
        }
      )
    );
    const disposableOverCapacity =
      currentWorkspace.engine.blob.onStatusChange.on(
        debounce(status => {
          const isOver = status?.isStorageOverCapacity;
          if (!isOver) {
            setIsOverCapacity(false);
            return;
          }
          setIsOverCapacity(true);
          if (isOwner) {
            pushNotification({
              type: 'warning',
              title: t['com.affine.payment.storage-limit.title'](),
              message:
                t['com.affine.payment.storage-limit.description.owner'](),
              actionLabel: t['com.affine.payment.storage-limit.view'](),
              action: jumpToPricePlan,
            });
          } else {
            pushNotification({
              type: 'warning',
              title: t['com.affine.payment.storage-limit.title'](),
              message:
                t['com.affine.payment.storage-limit.description.member'](),
            });
          }
        })
      );
    return () => {
      disposable?.dispose();
      disposableOverCapacity?.dispose();
    };
  }, [
    currentWorkspace,
    isOwner,
    jumpToPricePlan,
    pushNotification,
    setSyncEngineStatus,
    t,
  ]);

  const content = useMemo(() => {
    // TODO: add i18n
    if (currentWorkspace.flavour === WorkspaceFlavour.LOCAL) {
      if (!environment.isDesktop) {
        return 'This is a local demo workspace.';
      }
      return 'Saved locally';
    }
    if (!isOnline) {
      return 'Disconnected, please check your network connection';
    }
    if (!syncEngineStatus || syncEngineStatus.step === SyncEngineStep.Syncing) {
      return (
        `Syncing with AFFiNE Cloud` +
        (progress ? ` (${Math.floor(progress * 100)}%)` : '')
      );
    } else if (
      syncEngineStatus &&
      syncEngineStatus.step < SyncEngineStep.Syncing
    ) {
      return (
        syncEngineStatus.error ||
        'Disconnected, please check your network connection'
      );
    }
    if (syncEngineStatus.retrying) {
      return 'Sync disconnected due to unexpected issues, reconnecting.';
    }
    if (isOverCapacity) {
      return 'Sync failed due to insufficient cloud storage space.';
    }
    return 'Synced with AFFiNE Cloud';
  }, [
    currentWorkspace.flavour,
    isOnline,
    isOverCapacity,
    progress,
    syncEngineStatus,
  ]);

  const CloudWorkspaceSyncStatus = useCallback(() => {
    if (!syncEngineStatus || syncEngineStatus.step === SyncEngineStep.Syncing) {
      return SyncingWorkspaceStatus({
        progress: progress ? Math.max(progress, 0.2) : undefined,
      });
    } else if (syncEngineStatus.retrying || isOverCapacity) {
      return UnSyncWorkspaceStatus();
    } else {
      return CloudWorkspaceStatus();
    }
  }, [isOverCapacity, progress, syncEngineStatus]);

  return {
    message: content,
    icon:
      currentWorkspace.flavour === WorkspaceFlavour.AFFINE_CLOUD ? (
        !isOnline || syncEngineStatus?.error ? (
          <OfflineStatus />
        ) : (
          <CloudWorkspaceSyncStatus />
        )
      ) : (
        <LocalWorkspaceStatus />
      ),
    // TODO: simplify this
    active:
      currentWorkspace.flavour === WorkspaceFlavour.AFFINE_CLOUD &&
      !!(
        syncEngineStatus?.error ||
        !syncEngineStatus ||
        syncEngineStatus.step === SyncEngineStep.Syncing ||
        syncEngineStatus.retrying ||
        isOverCapacity
      ),
  };
};

const WorkspaceInfo = ({ name }: { name: string }) => {
  const { message, icon, active } = useSyncEngineSyncProgress();
  const currentWorkspace = useService(Workspace);
  const isCloud = currentWorkspace.flavour === WorkspaceFlavour.AFFINE_CLOUD;

  // to make sure that animation will play first time
  const [delayActive, setDelayActive] = useState(false);
  useEffect(() => {
    setDelayActive(active);
  }, [active]);

  return (
    <div className={styles.workspaceInfoSlider} data-active={delayActive}>
      <div className={styles.workspaceInfoSlide}>
        <div className={styles.workspaceInfo}>
          <div className={styles.workspaceName} data-testid="workspace-name">
            {name}
          </div>
          <div className={styles.workspaceStatus}>
            {isCloud ? <CloudWorkspaceStatus /> : <LocalWorkspaceStatus />}
          </div>
        </div>

        {/* when syncing/offline/... */}
        <div className={styles.workspaceInfo}>
          <div className={styles.workspaceActiveStatus}>
            <Tooltip content={message}>{icon}</Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

const avatarImageProps = {
  style: { borderRadius: 3 },
} satisfies AvatarProps['imageProps'];
export const WorkspaceCard = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => {
  const currentWorkspace = useService(Workspace);

  const information = useWorkspaceInfo(currentWorkspace.meta);

  const avatarUrl = useWorkspaceBlobObjectUrl(
    currentWorkspace.meta,
    information?.avatar
  );

  const name = information?.name ?? UNTITLED_WORKSPACE_NAME;

  return (
    <div
      className={styles.container}
      role="button"
      tabIndex={0}
      data-testid="current-workspace"
      id="current-workspace"
      ref={ref}
      {...props}
    >
      <Avatar
        imageProps={avatarImageProps}
        fallbackProps={avatarImageProps}
        data-testid="workspace-avatar"
        size={32}
        url={avatarUrl}
        name={name}
        colorfulFallback
      />
      <WorkspaceInfo name={name} />
    </div>
  );
});

WorkspaceCard.displayName = 'WorkspaceCard';
