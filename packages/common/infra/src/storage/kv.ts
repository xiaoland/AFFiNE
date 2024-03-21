import { AsyncLock } from '../utils';

export interface ByteKV extends ByteKVBehavior {
  transaction<T>(cb: (transaction: ByteKVBehavior) => Promise<T>): Promise<T>;
}

export interface ByteKVBehavior {
  get(key: string): Promise<Uint8Array | null> | Uint8Array | null;
  set(key: string, value: Uint8Array): Promise<void> | void;
  del(key: string): Promise<void> | void;
  keys(): Promise<string[]> | string[];
  clear(): Promise<void> | void;
}

export class MemoryByteKV implements ByteKV {
  readonly lock = new AsyncLock();

  constructor(readonly db = new Map<string, Uint8Array>()) {}

  async transaction<T>(cb: (transaction: ByteKVBehavior) => Promise<T>) {
    using _lock = await this.lock.acquire();
    return cb({
      get: async key => {
        return this.db.get(key) ?? null;
      },
      set: async (key, value) => {
        this.db.set(key, value);
      },
      keys: async () => {
        return Array.from(this.db.keys());
      },
      del: async key => {
        this.db.delete(key);
      },
      clear: async () => {
        this.db.clear();
      },
    });
  }
  get(key: string) {
    return this.transaction(async tx => tx.get(key));
  }
  set(key: string, value: Uint8Array) {
    return this.transaction(async tx => tx.set(key, value));
  }
  keys() {
    return this.transaction(async tx => tx.keys());
  }
  clear() {
    return this.transaction(async tx => tx.clear());
  }
  del(key: string) {
    return this.transaction(async tx => tx.del(key));
  }
}

export class ReadonlyByteKV extends MemoryByteKV implements ByteKV {
  override transaction<T>(
    _cb: (transaction: ByteKVBehavior) => Promise<T>
  ): Promise<T> {
    return Promise.resolve(null as T);
  }
  override set(_key: string, _value: Uint8Array): Promise<void> {
    return Promise.resolve();
  }
}
