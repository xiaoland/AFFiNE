import {
  type GlobalState,
  type Memento,
  type Workspace,
  type WorkspaceLocalState,
  wrapMemento,
} from '@toeverything/infra';

export class WorkspaceLocalStateImpl implements WorkspaceLocalState {
  wrapped: Memento;
  constructor(workspace: Workspace, globalState: GlobalState) {
    this.wrapped = wrapMemento(globalState, `workspace-state:${workspace.id}:`);
  }

  keys(): string[] {
    return this.wrapped.keys();
  }

  get<T>(key: string): T | null {
    return this.wrapped.get<T>(key);
  }

  watch<T>(key: string) {
    return this.wrapped.watch<T>(key);
  }

  set<T>(key: string, value: T | null): void {
    return this.wrapped.set<T>(key, value);
  }
}
