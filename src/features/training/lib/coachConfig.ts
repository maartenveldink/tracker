import { useSyncExternalStore } from 'react';

/**
 * Local-only configuration of the Claude coach (route B): the Anthropic API key
 * and the chosen model.
 *
 * Deliberately NOT in `AppSettings`/Dexie: the settings row carries sync
 * metadata (it is pushed to the backend) and is part of the JSON export. This
 * lives in `localStorage` under its own keys, which neither `exportData`,
 * `importData` nor the sync engine read. `clearCoachConfig()` is called from
 * `clearAllData()` ("Alles wissen" and sign-out), so the key is removed too.
 *
 * The key is readable by any script on the page; acceptable for this personal
 * app without third-party scripts. Never log it or put it in error messages.
 */

export const COACH_API_KEY_STORAGE = 'tracker.coach.apiKey';
export const COACH_MODEL_STORAGE = 'tracker.coach.model';

export const COACH_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (aanbevolen)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (grondiger, duurder)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (snel, goedkoop)' },
] as const;

export type CoachModel = (typeof COACH_MODELS)[number]['id'];
export const DEFAULT_COACH_MODEL: CoachModel = 'claude-sonnet-5-5';

export function isCoachModel(v: unknown): v is CoachModel {
  return COACH_MODELS.some(m => m.id === v);
}

export function coachModelLabel(model: CoachModel): string {
  return COACH_MODELS.find(m => m.id === model)?.label ?? model;
}

// localStorage can throw (disabled storage, quota); the coach then simply has no key.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

/**
 * A key must be printable ASCII without spaces: anything else (a zero-width
 * space or smart quote from copy-paste) makes `fetch` throw on the header,
 * which would otherwise look like a network error.
 */
export function isValidApiKeyFormat(key: string): boolean {
  return /^[\x21-\x7E]+$/.test(key);
}

export function getCoachApiKey(): string | null {
  const v = read(COACH_API_KEY_STORAGE)?.trim();
  return v ? v : null;
}

/** Stores the key (trimmed). Throws when storage is unavailable. */
export function setCoachApiKey(key: string): void {
  const k = key.trim();
  if (k === '') {
    clearCoachApiKey();
    return;
  }
  localStorage.setItem(COACH_API_KEY_STORAGE, k);
  notify();
}

export function clearCoachApiKey(): void {
  try {
    localStorage.removeItem(COACH_API_KEY_STORAGE);
  } catch {
    // nothing stored
  }
  notify();
}

export function getCoachModel(): CoachModel {
  const v = read(COACH_MODEL_STORAGE);
  return isCoachModel(v) ? v : DEFAULT_COACH_MODEL;
}

/** Returns false when storage is unavailable. */
export function setCoachModel(model: CoachModel): boolean {
  try {
    localStorage.setItem(COACH_MODEL_STORAGE, model);
  } catch {
    return false;
  }
  notify();
  return true;
}

/** Removes key and model (used by "Alles wissen" and sign-out). */
export function clearCoachConfig(): void {
  try {
    localStorage.removeItem(COACH_API_KEY_STORAGE);
    localStorage.removeItem(COACH_MODEL_STORAGE);
  } catch {
    // nothing stored
  }
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Other tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === COACH_API_KEY_STORAGE || e.key === COACH_MODEL_STORAGE) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Reactive view of the coach config. Exposes only WHETHER a key is set, never
 * the key itself, so components can't accidentally render it.
 */
export function useCoachConfig(): { hasKey: boolean; model: CoachModel } {
  const hasKey = useSyncExternalStore(subscribe, () => getCoachApiKey() !== null);
  const model = useSyncExternalStore(subscribe, getCoachModel);
  return { hasKey, model };
}
