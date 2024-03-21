import type { ServiceCollection, WorkspaceFactory } from '@toeverything/infra';
import {
  AwarenessContext,
  AwarenessProvider,
  DocEventBusImpl,
  DocStorageImpl,
  LocalBlobStorage,
  RemoteBlobStorage,
  WorkspaceIdContext,
  WorkspaceScope,
} from '@toeverything/infra';

import { BroadcastChannelAwarenessProvider } from './awareness';
import { IndexedDBBlobStorage } from './blob-indexeddb';
import { SQLiteBlobStorage } from './blob-sqlite';
import { StaticBlobStorage } from './blob-static';
import { BroadcastChannelDocEventBus } from './doc-broadcast-channel';
import { IndexedDBDocStorage } from './doc-indexeddb';
import { SqliteDocStorage } from './doc-sqlite';

export class LocalWorkspaceFactory implements WorkspaceFactory {
  name = 'local';
  configureWorkspace(services: ServiceCollection): void {
    if (environment.isDesktop) {
      services
        .scope(WorkspaceScope)
        .addImpl(LocalBlobStorage, SQLiteBlobStorage, [WorkspaceIdContext])
        .addImpl(DocStorageImpl, SqliteDocStorage, [WorkspaceIdContext])
        .addImpl(DocEventBusImpl, BroadcastChannelDocEventBus, [
          WorkspaceIdContext,
        ]);
    } else {
      services
        .scope(WorkspaceScope)
        .addImpl(LocalBlobStorage, IndexedDBBlobStorage, [WorkspaceIdContext])
        .addImpl(DocStorageImpl, IndexedDBDocStorage, [WorkspaceIdContext])
        .addImpl(DocEventBusImpl, BroadcastChannelDocEventBus, [
          WorkspaceIdContext,
        ]);
    }

    services
      .scope(WorkspaceScope)
      .addImpl(RemoteBlobStorage('static'), StaticBlobStorage)
      .addImpl(
        AwarenessProvider('broadcast-channel'),
        BroadcastChannelAwarenessProvider,
        [WorkspaceIdContext, AwarenessContext]
      );
  }
  async getWorkspaceBlob(id: string, blobKey: string): Promise<Blob | null> {
    const blobStorage = environment.isDesktop
      ? new SQLiteBlobStorage(id)
      : new IndexedDBBlobStorage(id);

    return await blobStorage.get(blobKey);
  }
}
