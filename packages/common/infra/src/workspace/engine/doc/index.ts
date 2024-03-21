import { DebugLogger } from '@affine/debug';
import { nanoid } from 'nanoid';
import { map } from 'rxjs';
import type { Doc as YDoc } from 'yjs';

import { createIdentifier } from '../../../di';
import { LiveData } from '../../../livedata';
import { MANUALLY_STOP } from '../../../utils';
import { type DocEventBus, DocEventBusInner } from './event';
import { DocEngineLocalPart } from './local';
import { DocEngineRemotePart } from './remote';
import type { DocServer } from './server';
import { type DocStorage, DocStorageInner } from './storage';

const logger = new DebugLogger('doc-engine');

export type { DocEvent, DocEventBus } from './event';
export { MemoryDocEventBus } from './event';
export type { DocServer } from './server';
export type { DocStorage } from './storage';
export {
  MemoryStorage as MemoryDocStorage,
  ReadonlyStorage as ReadonlyDocStorage,
} from './storage';

export const DocEventBusImpl = createIdentifier<DocEventBus>('DocEventBus');

export const DocServerImpl = createIdentifier<DocServer>('DocServer');

export const DocStorageImpl = createIdentifier<DocStorage>('DocStorage');

export class DocEngine {
  localPart: DocEngineLocalPart;
  remotePart: DocEngineRemotePart | null;

  storage: DocStorageInner;
  eventBus: DocEventBusInner;

  engineState = LiveData.computed(get => {
    const localState = get(this.localPart.engineState);
    if (this.remotePart) {
      const remoteState = get(this.remotePart?.engineState);
      return {
        total: remoteState.total,
        syncing: remoteState.syncing,
        saving: localState.syncing,
        retrying: remoteState.retrying,
        errorMessage: remoteState.errorMessage,
      };
    }
    return {
      total: localState.total,
      syncing: localState.syncing,
      saving: localState.syncing,
      retrying: false,
      errorMessage: null,
    };
  });

  docState(docId: string) {
    const localState = this.localPart.docState(docId);
    const remoteState = this.remotePart?.docState(docId);
    return LiveData.computed(get => {
      const local = get(localState);
      const remote = remoteState ? get(remoteState) : null;
      return {
        ready: local.ready,
        saving: local.syncing,
        syncing: local.syncing || remote?.syncing,
      };
    });
  }

  constructor(
    storage: DocStorage,
    eventBus: DocEventBus,
    private readonly server?: DocServer | null
  ) {
    const clientId = nanoid();
    this.storage = new DocStorageInner(storage);
    this.eventBus = new DocEventBusInner(eventBus);
    this.localPart = new DocEngineLocalPart(
      clientId,
      this.storage,
      this.eventBus
    );
    this.remotePart = this.server
      ? new DocEngineRemotePart(
          clientId,
          this.storage,
          this.server,
          this.eventBus
        )
      : null;
  }

  abort = new AbortController();

  start() {
    this.abort.abort(MANUALLY_STOP);
    this.abort = new AbortController();
    Promise.all([
      this.localPart.mainLoop(this.abort.signal),
      this.remotePart?.mainLoop(this.abort.signal),
    ]).catch(err => {
      if (err === MANUALLY_STOP) {
        return;
      }
      logger.error('Doc engine error', err);
    });
    return this;
  }

  stop() {
    this.abort.abort(MANUALLY_STOP);
  }

  async resetSyncStatus() {
    this.stop();
    await this.storage.clearSyncMetadata();
    await this.storage.clearServerClock();
  }

  addDoc(doc: YDoc, withSubDocs = true) {
    this.localPart.actions.addDoc(doc);
    this.remotePart?.actions.addDoc(doc.guid);

    if (withSubDocs) {
      const subdocs = doc.getSubdocs();
      for (const subdoc of subdocs) {
        this.addDoc(subdoc, false);
      }
      doc.on('subdocs', ({ added }: { added: Set<YDoc> }) => {
        for (const subdoc of added) {
          this.addDoc(subdoc, false);
        }
      });
    }
  }

  setPriority(docId: string, priority: number) {
    this.localPart.setPriority(docId, priority);
    this.remotePart?.setPriority(docId, priority);
  }

  waitForSaved() {
    return new Promise<void>(resolve => {
      this.engineState
        .pipe(map(state => state.saving === 0))
        .subscribe(saved => {
          if (saved) {
            resolve();
          }
        });
    });
  }

  waitForSynced() {
    return new Promise<void>(resolve => {
      this.engineState
        .pipe(map(state => state.syncing === 0 && state.saving === 0))
        .subscribe(synced => {
          if (synced) {
            resolve();
          }
        });
    });
  }

  waitForReady(docId: string) {
    return new Promise<void>(resolve => {
      this.docState(docId)
        .pipe(map(state => state.ready))
        .subscribe(ready => {
          if (ready) {
            resolve();
          }
        });
    });
  }
}
