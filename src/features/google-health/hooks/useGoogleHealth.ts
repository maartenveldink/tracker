import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type GoogleHealthConnection, type GoogleHealthDay } from '../../../db/index';
import { syncGoogleHealth } from '../lib/syncService';
import { getClientId } from '../lib/oauth';

export interface GoogleHealthState {
  /** Whether VITE_GOOGLE_CLIENT_ID is configured in this build. */
  isConfigured: boolean;
  /** The stored connection row, or undefined while loading, or null if not connected. */
  connection: GoogleHealthConnection | null | undefined;
  /** Health data rows, sorted by date descending. */
  healthData: GoogleHealthDay[];
  /** True while the initial IndexedDB query is loading. */
  isLoading: boolean;
}

/**
 * Provides Google Health connection state and synced data.
 * Triggers an automatic sync on mount when connected and online (E7-11).
 */
export function useGoogleHealth(): GoogleHealthState {
  const isConfigured = Boolean(getClientId());

  const connection = useLiveQuery(() => db.googleHealthConnection.get(1));
  const healthData = useLiveQuery(
    () => db.googleHealthData.orderBy('date').reverse().toArray(),
  ) ?? [];

  const isLoading = connection === undefined;

  // Auto-sync when connected and online (E7-11)
  useEffect(() => {
    if (!connection || !navigator.onLine) return;
    void syncGoogleHealth().catch(() => {
      // Errors are persisted in the connection row; UI reads them from there.
    });
  }, [connection?.id]); // only trigger on connect, not on every connection update

  return {
    isConfigured,
    connection: connection ?? null,
    healthData,
    isLoading,
  };
}

/**
 * Returns the most recent N days of health data as a map from date → row.
 * Useful for dashboard charts (E7-16, E7-23–E7-25, to be wired once Epic 10 is built).
 */
export function useHealthDataByDate(days = 90): Map<string, GoogleHealthDay> {
  const data = useLiveQuery(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return db.googleHealthData
      .where('date')
      .aboveOrEqual(cutoffStr)
      .toArray();
  }, [days]) ?? [];

  const map = new Map<string, GoogleHealthDay>();
  for (const row of data) {
    map.set(row.date, row);
  }
  return map;
}
