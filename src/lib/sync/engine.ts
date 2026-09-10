import type { Table } from 'dexie';
import { ClientResponseError } from 'pocketbase';
import { db } from '@/db/index';
import { pb, currentUserId, hasStoredIdentity } from '@/lib/pb';
import { setSyncState } from './status';

/**
 * Offline-first sync engine (see `docs/design.multi-user-sync.md`).
 *
 * IndexedDB stays the source of truth during use; this pushes locally-changed
 * rows (dirty=1) to PocketBase and pulls remote changes since a per-collection
 * cursor. Conflicts resolve last-write-wins on `clientUpdatedAt`. Deletes are
 * tombstones (`deleted=true`) so they propagate both ways. Everything degrades
 * gracefully offline — failures pause sync, they never touch local data or lock
 * the user out.
 */

interface SyncedRecord {
  id: string;
  clientUpdatedAt: number;
  deleted: boolean;
  dirty: 0 | 1;
  isDefault?: boolean;
}

interface TableSync {
  collection: string;
  table: Table<SyncedRecord, string>;
}

const TABLES: TableSync[] = [
  { collection: 'exercises', table: db.exercises as unknown as Table<SyncedRecord, string> },
  { collection: 'schemas', table: db.schemas as unknown as Table<SyncedRecord, string> },
  { collection: 'workouts', table: db.workouts as unknown as Table<SyncedRecord, string> },
  { collection: 'body_weights', table: db.bodyWeights as unknown as Table<SyncedRecord, string> },
  { collection: 'habits', table: db.habits as unknown as Table<SyncedRecord, string> },
  { collection: 'habit_logs', table: db.habitLogs as unknown as Table<SyncedRecord, string> },
];

const cursorKey = (c: string) => `tracker.sync.cursor.${c}`;

// `settings` is a local singleton (Dexie key id=1) but one row per user on the
// server. We remember the server record id here so we can upsert it.
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_ID_KEY = 'tracker.sync.settingsRecordId';

// True while the engine itself is writing to Dexie (pull applies, dirty clears),
// so the mutation triggers don't treat our own writes as user edits.
let suppressTrigger = false;

async function suppressed(fn: () => Promise<void>): Promise<void> {
  suppressTrigger = true;
  try {
    await fn();
  } finally {
    suppressTrigger = false;
  }
}

/** Strip the client-only dirty flag; the rest is the document we store server-side. */
function toData(record: SyncedRecord): Record<string, unknown> {
  const { dirty: _dirty, ...rest } = record;
  return rest;
}

/** Rebuild a local row from a PocketBase record; it arrives clean (dirty=0). */
function fromRecord(rec: { data: Record<string, unknown> }): SyncedRecord {
  return { ...(rec.data as unknown as SyncedRecord), dirty: 0 };
}

function is404(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404;
}

// --- Push -----------------------------------------------------------------

async function pushTable({ collection, table }: TableSync, userId: string): Promise<void> {
  const dirty = await table.where('dirty').equals(1).toArray();
  for (const row of dirty) {
    if (row.isDefault) {
      // Default library rows are seeded per device, never synced.
      await table.update(row.id, { dirty: 0 });
      continue;
    }
    const payload = {
      id: row.id,
      user: userId,
      data: toData(row),
      clientUpdatedAt: row.clientUpdatedAt,
      deleted: row.deleted,
    };
    try {
      await pb.collection(collection).update(row.id, payload);
    } catch (err) {
      if (is404(err)) {
        await pb.collection(collection).create(payload);
      } else {
        throw err;
      }
    }
    // Only clear dirty if the row wasn't edited again while we were pushing.
    const fresh = await table.get(row.id);
    if (fresh && fresh.clientUpdatedAt === row.clientUpdatedAt) {
      suppressTrigger = true;
      try {
        await table.update(row.id, { dirty: 0 });
      } finally {
        suppressTrigger = false;
      }
    }
  }
}

// --- Pull -----------------------------------------------------------------

async function pullTable({ collection, table }: TableSync): Promise<void> {
  const cursor = localStorage.getItem(cursorKey(collection)) ?? '';
  const filter = cursor ? `updated > "${cursor}"` : '';
  const records = await pb.collection(collection).getFullList({
    filter,
    sort: 'updated',
  });

  let newCursor = cursor;
  for (const rec of records) {
    const incoming = fromRecord(rec as unknown as { data: Record<string, unknown> });
    const local = await table.get(incoming.id);
    // Last-write-wins: take the server row unless the local one is newer AND
    // still pending push (would otherwise clobber an unsynced local edit).
    const localWins =
      local && local.dirty === 1 && local.clientUpdatedAt > incoming.clientUpdatedAt;
    if (!localWins) {
      suppressTrigger = true;
      try {
        await table.put(incoming);
      } finally {
        suppressTrigger = false;
      }
    }
    const updated = (rec as { updated?: string }).updated;
    if (updated && updated > newCursor) newCursor = updated;
  }
  if (newCursor !== cursor) localStorage.setItem(cursorKey(collection), newCursor);
}

// --- Settings (local singleton id=1, one row per user server-side) ---------

interface LocalSettings {
  id: 1;
  clientUpdatedAt?: number;
  dirty?: 0 | 1;
  [k: string]: unknown;
}

/** Strip Dexie key + dirty flag; the rest is the document stored server-side. */
function settingsData(s: LocalSettings): Record<string, unknown> {
  const { dirty: _dirty, ...rest } = s;
  return rest;
}

async function pushSettings(userId: string): Promise<void> {
  const local = (await db.settings.get(1)) as LocalSettings | undefined;
  if (!local || local.dirty !== 1) return;

  const payload = {
    user: userId,
    data: settingsData(local),
    clientUpdatedAt: local.clientUpdatedAt ?? Date.now(),
    deleted: false,
  };

  let recordId = localStorage.getItem(SETTINGS_ID_KEY);
  try {
    if (!recordId) {
      // First push on this device: reuse the user's existing row if any.
      const existing = await pb.collection(SETTINGS_COLLECTION).getList(1, 1);
      recordId = existing.items[0]?.id ?? null;
    }
    if (recordId) {
      await pb.collection(SETTINGS_COLLECTION).update(recordId, payload);
    } else {
      const created = await pb.collection(SETTINGS_COLLECTION).create(payload);
      recordId = created.id;
    }
  } catch (err) {
    if (is404(err)) {
      const created = await pb.collection(SETTINGS_COLLECTION).create(payload);
      recordId = created.id;
    } else {
      throw err;
    }
  }
  localStorage.setItem(SETTINGS_ID_KEY, recordId);

  // Clear dirty only if settings weren't edited again while pushing.
  const fresh = (await db.settings.get(1)) as LocalSettings | undefined;
  if (fresh && fresh.clientUpdatedAt === local.clientUpdatedAt) {
    await suppressed(async () => { await db.settings.update(1, { dirty: 0 }); });
  }
}

async function pullSettings(): Promise<void> {
  const list = await pb.collection(SETTINGS_COLLECTION).getList(1, 1, { sort: '-updated' });
  const rec = list.items[0] as unknown as { id: string; data: LocalSettings } | undefined;
  if (!rec) return;
  localStorage.setItem(SETTINGS_ID_KEY, rec.id);

  const incoming = rec.data;
  const local = (await db.settings.get(1)) as LocalSettings | undefined;
  const localWins =
    local && local.dirty === 1 && (local.clientUpdatedAt ?? 0) > (incoming.clientUpdatedAt ?? 0);
  if (!localWins) {
    await suppressed(async () => {
      await db.settings.put({ ...incoming, id: 1, dirty: 0 } as never);
    });
  }
}

// --- Orchestration --------------------------------------------------------

let running = false;
let queued = false;

/** Push then pull every collection once. Safe to call frequently. */
export async function syncNow(): Promise<void> {
  if (!hasStoredIdentity()) return;
  if (!navigator.onLine) {
    setSyncState('offline');
    return;
  }
  if (running) {
    queued = true;
    return;
  }
  running = true;
  setSyncState('syncing');
  try {
    // Opportunistically refresh the auth token; ignore failure (stay usable).
    if (!pb.authStore.isValid) {
      try {
        await pb.collection('users').authRefresh();
      } catch {
        // Token can't be refreshed (offline/expired). Leave the app usable but
        // don't attempt authed calls this tick.
        setSyncState('offline');
        return;
      }
    }
    const userId = currentUserId();
    if (!userId) return;

    for (const t of TABLES) await pushTable(t, userId);
    await pushSettings(userId);
    for (const t of TABLES) await pullTable(t);
    await pullSettings();
    setSyncState('synced');
  } catch (err) {
    if (err instanceof ClientResponseError && (err.status === 0 || err.isAbort)) {
      setSyncState('offline');
    } else {
      console.error('[sync] failed:', err);
      setSyncState('error');
    }
  } finally {
    running = false;
    if (queued) {
      queued = false;
      void syncNow();
    }
  }
}

// --- Scheduling -----------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;

/** Debounced trigger — call after local mutations. */
export function requestSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), 1500);
}

let triggersRegistered = false;

/** Register Dexie hooks so a user mutation schedules a (debounced) sync. */
function registerMutationTriggers(): void {
  if (triggersRegistered) return;
  triggersRegistered = true;
  const onWrite = () => {
    if (!suppressTrigger) requestSync();
  };
  for (const { table } of TABLES) {
    table.hook('creating', onWrite);
    table.hook('updating', onWrite);
  }
  // Settings live in their own singleton table, synced separately.
  db.settings.hook('creating', onWrite);
  db.settings.hook('updating', onWrite);
}

/** Wire up start / reconnect / periodic / mutation triggers. Returns cleanup. */
export function startSync(): () => void {
  registerMutationTriggers();
  void syncNow();
  const onOnline = () => void syncNow();
  window.addEventListener('online', onOnline);
  intervalTimer = setInterval(() => void syncNow(), 60_000);
  return () => {
    window.removeEventListener('online', onOnline);
    if (intervalTimer) clearInterval(intervalTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

/** Clears sync cursors (used on logout so the next account starts fresh). */
export function resetSyncCursors(): void {
  for (const t of TABLES) localStorage.removeItem(cursorKey(t.collection));
  localStorage.removeItem(SETTINGS_ID_KEY);
}
