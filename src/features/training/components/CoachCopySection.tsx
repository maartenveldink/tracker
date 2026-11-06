import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Check, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '../../../hooks/useSettings';
import { buildCoachSummary, type CoachPeriodWeeks } from '../lib/coachSummary';
import { buildCoachPrompt } from '../lib/coachPrompt';
import { db, type TrainingSchema } from '../../../db/index';

const PERIODS: CoachPeriodWeeks[] = [4, 8];

/**
 * "Kopieer voor Claude" (route A): copies a prompt + JSON Schema + compact
 * training summary to the clipboard, to paste into claude.ai. The answer
 * (JSON only) can be pasted back at "Importeer schema".
 */
export function CoachCopySection({ schema }: { schema: TrainingSchema }) {
  const settings = useSettings();
  // `undefined` = still loading (don't offer a copy of an empty summary).
  // Exercises include deleted ones so their history still counts.
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const workouts = useLiveQuery(() =>
    db.workouts.where('status').equals('completed').filter(w => !w.deleted).toArray(),
  );
  const bodyWeights = useLiveQuery(() => db.bodyWeights.filter(b => !b.deleted).toArray());
  const loaded = exercises !== undefined && workouts !== undefined && bodyWeights !== undefined;

  const [weeks, setWeeks] = useState<CoachPeriodWeeks>(4);
  const [goal, setGoal] = useState('');
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const prompt = useMemo(() => {
    if (!exercises || !workouts || !bodyWeights) return '';
    const summary = buildCoachSummary({
      workouts,
      exercises,
      schema,
      bodyWeights,
      weeks,
      oneRMFormula: settings.oneRMFormula,
    });
    return buildCoachPrompt({ summary, goal });
  }, [workouts, exercises, schema, bodyWeights, weeks, settings.oneRMFormula, goal]);

  // "Gekopieerd" only describes the prompt that was copied; reset on any change.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    setCopied(false);
    setFailed(false);
  }, [prompt]);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }

  return (
    <section className="px-4 py-3" aria-labelledby="coach-copy-heading" data-testid="coach-copy">
      <h2 id="coach-copy-heading" className="text-sm font-medium text-muted-foreground">
        Analyse door Claude
      </h2>
      <p className="text-xs text-muted-foreground/80 mb-3">
        Kopieer een samenvatting van je training (geen ruwe sets of datums; je notities gaan wel letterlijk mee) en plak die in claude.ai.
        Plak het voorgestelde schema daarna terug via{' '}
        <Link to="/schemas/import" className="underline">Importeer schema</Link>.
      </p>

      <div role="group" aria-label="Periode" className="flex gap-2 mb-3">
        {PERIODS.map(p => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={weeks === p ? 'default' : 'secondary'}
            aria-pressed={weeks === p}
            onClick={() => setWeeks(p)}
          >
            {p} weken
          </Button>
        ))}
      </div>

      <textarea
        aria-label="Doel of vraag (optioneel)"
        value={goal}
        onChange={e => setGoal(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Doel of vraag, bijv. “meer rug” of “knie-vriendelijk” (optioneel)"
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <Button type="button" className="mt-3 w-full" onClick={copy} disabled={!loaded}>
        {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        {copied ? 'Gekopieerd' : 'Kopieer voor Claude'}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-xs text-amber-400">
          Kopiëren is niet gelukt. Open het voorbeeld hieronder en kopieer de tekst handmatig.
        </p>
      )}

      <details className="mt-3 group" data-testid="coach-preview">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Voorbeeld van wat gekopieerd wordt ({loaded ? `≈ ${Math.round(prompt.length / 4).toLocaleString('nl-NL')} tokens` : 'laden…'})
        </summary>
        <textarea
          readOnly
          aria-label="Gekopieerde tekst"
          value={prompt}
          onFocus={e => e.currentTarget.select()}
          spellCheck={false}
          className="mt-2 w-full h-64 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-[11px] shadow-sm"
        />
      </details>
    </section>
  );
}
