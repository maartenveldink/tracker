import { useMemo } from 'react';
import { getMuscleGroupById } from '../db/muscles';

/**
 * Volume-per-muscle-group bar list. Shared by the live workout view (to decide
 * which muscles still need work) and the post-workout summary.
 */
export function MuscleVolumeBars({ volume }: { volume: Map<string, number> }) {
  const sorted = useMemo(
    () =>
      Array.from(volume.entries())
        .map(([id, vol]) => ({ id, name: getMuscleGroupById(id)?.name ?? id, volume: vol }))
        .sort((a, b) => b.volume - a.volume),
    [volume],
  );

  if (sorted.length === 0) return null;

  const maxVolume = sorted[0]?.volume ?? 1;

  return (
    <div className="space-y-2">
      {sorted.map(({ id, name, volume: vol }) => {
        const percentage = (vol / maxVolume) * 100;
        return (
          <div key={id}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-card-foreground">{name}</span>
              <span className="text-muted-foreground">{Math.round(vol)} kg</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
