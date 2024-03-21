import { Unreachable } from '@affine/env/constant';
import { WorkspaceFlavour } from '@affine/env/workspace';
import { Slot } from '@blocksuite/global/utils';
import type { DocCollection } from '@blocksuite/store';
import { applyUpdate, Doc as YDoc, encodeStateAsUpdate } from 'yjs';

import { checkWorkspaceCompatibility, MigrationPoint } from '../blocksuite';
import { forceUpgradePages, upgradeV1ToV2 } from '../blocksuite';
import { migrateGuidCompatibility } from '../blocksuite';
import type { DocEngine } from './engine';
import type { WorkspaceManager } from './manager';
import { type WorkspaceMetadata } from './metadata';

export interface WorkspaceUpgradeStatus {
  needUpgrade: boolean;
  upgrading: boolean;
}

export class WorkspaceUpgradeController {
  _status: Readonly<WorkspaceUpgradeStatus> = {
    needUpgrade: false,
    upgrading: false,
  };
  readonly onStatusChange = new Slot<WorkspaceUpgradeStatus>();

  get status() {
    return this._status;
  }

  set status(value) {
    if (
      value.needUpgrade !== this._status.needUpgrade ||
      value.upgrading !== this._status.upgrading
    ) {
      this._status = value;
      this.onStatusChange.emit(value);
    }
  }

  constructor(
    private readonly docCollection: DocCollection,
    private readonly docEngine: DocEngine,
    private readonly workspaceMetadata: WorkspaceMetadata
  ) {
    docCollection.doc.on('update', () => {
      this.checkIfNeedUpgrade();
    });
  }

  checkIfNeedUpgrade() {
    const needUpgrade = !!checkWorkspaceCompatibility(
      this.docCollection,
      this.workspaceMetadata.flavour === WorkspaceFlavour.AFFINE_CLOUD
    );
    this.status = {
      ...this.status,
      needUpgrade,
    };
    return needUpgrade;
  }

  async upgrade(
    workspaceManager: WorkspaceManager
  ): Promise<WorkspaceMetadata | null> {
    if (this.status.upgrading) {
      return null;
    }

    this.status = { ...this.status, upgrading: true };

    try {
      await this.docEngine.waitForSynced();

      const step = checkWorkspaceCompatibility(
        this.docCollection,
        this.workspaceMetadata.flavour === WorkspaceFlavour.AFFINE_CLOUD
      );

      if (!step) {
        return null;
      }

      // Clone a new doc to prevent change events.
      const clonedDoc = new YDoc({
        guid: this.docCollection.doc.guid,
      });
      applyDoc(clonedDoc, this.docCollection.doc);

      if (step === MigrationPoint.SubDoc) {
        const newWorkspace = await workspaceManager.createWorkspace(
          WorkspaceFlavour.LOCAL,
          async (workspace, blobStorage) => {
            await upgradeV1ToV2(clonedDoc, workspace.doc);
            migrateGuidCompatibility(clonedDoc);
            await forceUpgradePages(workspace.doc, this.docCollection.schema);
            const blobList = await this.docCollection.blob.list();

            for (const blobKey of blobList) {
              const blob = await this.docCollection.blob.get(blobKey);
              if (blob) {
                await blobStorage.set(blobKey, blob);
              }
            }
          }
        );
        await workspaceManager.deleteWorkspace(this.workspaceMetadata);
        return newWorkspace;
      } else if (step === MigrationPoint.GuidFix) {
        migrateGuidCompatibility(clonedDoc);
        await forceUpgradePages(clonedDoc, this.docCollection.schema);
        applyDoc(this.docCollection.doc, clonedDoc);
        await this.docEngine.waitForSynced();
        return null;
      } else if (step === MigrationPoint.BlockVersion) {
        await forceUpgradePages(clonedDoc, this.docCollection.schema);
        applyDoc(this.docCollection.doc, clonedDoc);
        await this.docEngine.waitForSynced();
        return null;
      } else {
        throw new Unreachable();
      }
    } finally {
      this.status = { ...this.status, upgrading: false };
    }
  }
}

function applyDoc(target: YDoc, result: YDoc) {
  applyUpdate(target, encodeStateAsUpdate(result));
  for (const targetSubDoc of target.subdocs.values()) {
    const resultSubDocs = Array.from(result.subdocs.values());
    const resultSubDoc = resultSubDocs.find(
      item => item.guid === targetSubDoc.guid
    );
    if (resultSubDoc) {
      applyDoc(targetSubDoc, resultSubDoc);
    }
  }
}
