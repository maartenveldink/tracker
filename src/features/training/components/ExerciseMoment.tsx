import { cn } from '@/lib/utils';
import type { SessionComparison } from '../lib/celebration';
import { prefersReducedMotion } from './CelebrationEffects';
import { formatDecimal } from '../lib/liveTraining';

const line = (s: { weight: number; reps: number } | null) =>
  s ? `${formatDecimal(s.weight)} × ${s.reps}` : '–';

/** Spoken/visible summary: "+2 herhalingen · +40 kg volume". */
export function momentSubline(c: SessionComparison): string {
  const parts: string[] = [];
  if (c.repsDelta > 0) parts.push(`+${c.repsDelta} ${c.repsDelta === 1 ? 'herhaling' : 'herhalingen'}`);
  const vol = c.volumeDelta;
  parts.push(`${vol >= 0 ? '+' : '−'}${formatDecimal(Math.abs(vol))} kg volume`);
  return parts.join(' · ');
}

/**
 * "Oefening klaar" banner + comparison table (DESIGN §8). Always rendered
 * statically when the exercise was better; the pop/fade animations are CSS and
 * collapse to the end state under prefers-reduced-motion (tokens set the
 * durations to 0) or when `animate` is false (e.g. after a reload).
 */
export function ExerciseMoment({ comparison, animate: animateProp }: { comparison: SessionComparison; animate: boolean }) {
  const animate = animateProp && !prefersReducedMotion();
  return (
    <section data-testid="exercise-moment" aria-label="Oefening klaar" className="flex flex-col gap-3">
      <p className="text-caption font-semibold uppercase tracking-wide text-muted">Oefening klaar</p>
      <div
        role="status"
        data-testid="moment-banner"
        className={cn(
          'flex flex-col items-center gap-1 rounded-card bg-accent px-4 py-4 text-center text-on-accent',
          animate && 'animate-banner-pop',
        )}
      >
        <span className="font-display text-hero font-bold leading-tight">Beter dan vorige keer</span>
        <span className="text-small font-semibold">{momentSubline(comparison)}</span>
      </div>
      <table
        data-testid="moment-table"
        className={cn('w-full border-separate border-spacing-y-1.5 text-body', animate && 'animate-moment-fade [animation-delay:0.3s]')}
      >
        <caption className="sr-only">Vergelijking per set met vorige keer</caption>
        <thead>
          <tr className="text-caption text-muted">
            <th scope="col" className="text-left font-medium">Set</th>
            <th scope="col" className="text-left font-medium">Vandaag</th>
            <th scope="col" className="text-left font-medium">Vorige keer</th>
            <th scope="col" className="text-right font-medium">Verschil</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((r, i) => (
            <tr key={i} className="bg-surface">
              <td className="rounded-l-row px-3 py-2 text-muted">{i + 1}</td>
              <td className="py-2 font-semibold">{line(r.today)}</td>
              <td className="py-2 text-muted">{line(r.previous)}</td>
              <td
                className={cn(
                  'rounded-r-row px-3 py-2 text-right font-semibold',
                  r.repsDiff !== null && r.repsDiff > 0 ? 'text-accent' : 'text-muted',
                  animate && 'animate-moment-fade',
                )}
                style={animate ? { animationDelay: `${0.5 + i * 0.18}s` } : undefined}
              >
                {r.repsDiff === null ? '–' : r.repsDiff > 0 ? `+${r.repsDiff}` : r.repsDiff < 0 ? `−${Math.abs(r.repsDiff)}` : '='}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
