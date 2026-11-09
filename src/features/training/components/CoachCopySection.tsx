import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CoachPeriodWeeks } from '../lib/coachSummary';
import { buildCoachPrompt } from '../lib/coachPrompt';
import { useCoachSummary } from '../hooks/useCoachSummary';
import type { TrainingSchema } from '../../../db/index';

const PERIODS: CoachPeriodWeeks[] = [4, 8];

/**
 * "Kopieer voor AI" (copy/paste): copies a prompt + JSON Schema + compact
 * training summary to the clipboard, to paste into an AI chat. The answer
 * (JSON only) can be pasted back at "Importeer schema".
 */
export function CoachCopySection({ schema }: { schema: TrainingSchema }) {
  const [weeks, setWeeks] = useState<CoachPeriodWeeks>(4);
  const [goal, setGoal] = useState('');
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  // `undefined` = still loading (don't offer a copy of an empty summary).
  const { summary } = useCoachSummary(schema, weeks);
  const loaded = summary !== undefined;
  const prompt = useMemo(() => (summary ? buildCoachPrompt({ summary, goal }) : ''), [summary, goal]);

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
    <section className="px-screen-x py-3" aria-labelledby="coach-copy-heading" data-testid="coach-copy">
      <h2 id="coach-copy-heading" className="text-small font-medium text-muted">
        Analyse door AI
      </h2>
      <p className="text-caption text-muted/80 mb-3">
        Kopieer een samenvatting van je training (geen ruwe sets of datums; je notities gaan wel letterlijk mee) en plak die in je AI-assistent (ChatGPT, Claude, Gemini, ...).
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
        className="w-full rounded-row border border-input bg-transparent px-3 py-2 text-small  placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <Button type="button" className="mt-3 w-full" onClick={copy} disabled={!loaded}>
        {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        {copied ? 'Gekopieerd' : 'Kopieer voor AI'}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 text-caption text-destructive">
          Kopiëren is niet gelukt. Open het voorbeeld hieronder en kopieer de tekst handmatig.
        </p>
      )}

      <details className="mt-3 group" data-testid="coach-preview">
        <summary className="cursor-pointer text-caption text-muted">
          Voorbeeld van wat gekopieerd wordt ({loaded ? `≈ ${Math.round(prompt.length / 4).toLocaleString('nl-NL')} tokens` : 'laden…'})
        </summary>
        <textarea
          readOnly
          aria-label="Gekopieerde tekst"
          value={prompt}
          onFocus={e => e.currentTarget.select()}
          spellCheck={false}
          className="mt-2 w-full h-64 rounded-row border border-input bg-transparent px-3 py-2 font-mono text-caption "
        />
      </details>
    </section>
  );
}
