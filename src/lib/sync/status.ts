import { useSyncExternalStore } from 'react';

/**
 * Tiny observable for the current sync state, surfaced in the UI (requirement
 * D-07). Deliberately framework-light: a value + listener set.
 */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

let state: SyncState = 'idle';
let lastSyncedAt: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setSyncState(next: SyncState): void {
  state = next;
  if (next === 'synced') lastSyncedAt = Date.now();
  emit();
}

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
}

let snapshot: SyncStatus = { state, lastSyncedAt };
function getSnapshot(): SyncStatus {
  // Recompute only when values changed so useSyncExternalStore stays stable.
  if (snapshot.state !== state || snapshot.lastSyncedAt !== lastSyncedAt) {
    snapshot = { state, lastSyncedAt };
  }
  return snapshot;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: the current sync status. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
