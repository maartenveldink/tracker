import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, KeyRound, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db, type TrainingSchema } from '../../../db/index';
import type { CoachPeriodWeeks } from '../lib/coachSummary';
import { useCoachSummary } from '../hooks/useCoachSummary';
import { coachModelLabel, getCoachApiKey, getCoachModel, useCoachConfig } from '../lib/coachConfig';
import { CoachError, requestCoachProposal, type CoachProposal } from '../lib/claudeCoach';
import { diffSchemas, type DiffRow, type DiffSection } from '../lib/coachDiff';
import { formatPrescription, type SchemaJson, type SchemaJsonExercise } from '../lib/schemaJson';
import { importSharedSchema, summarizeSharedSchema } from '../lib/schemaShare';

const PERIODS: CoachPeriodWeeks[] = [4, 8];

type RunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: CoachError }
  | { status: 'done'; proposal: CoachProposal; current: SchemaJson | null };

/**
 * Claude coach, route B: sends the training summary to the Anthropic API and
 * shows the analysis + a diff of the proposed schema against the current one.
 * The proposal is only ever saved as a NEW schema.
 *
 * All AI text is rendered as plain React text (never as HTML/Markdown), so a
 * malicious or odd answer can't inject markup.
 */
export function CoachPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // null = not found / deleted; undefined = loading.
  const schema = useLiveQuery(
    async (): Promise<TrainingSchema | null> => {
      if (!id) return null;
      const s = await db.schemas.get(id);
      return s && !s.deleted ? s : null;
    },
    [id],
  );
  const { hasKey, model } = useCoachConfig();

  const [weeks, setWeeks] = useState<CoachPeriodWeeks>(4);
  const [goal, setGoal] = useState('');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const { summary, exercises } = useCoachSummary(schema ?? null, weeks);

  // Leaving the page cancels a running request.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const libraryNames = useMemo(
    () => (exercises ?? []).filter(e => !e.deleted).map(e => e.name),
    [exercises],
  );

  const diff = useMemo(
    () => (run.status === 'done' ? diffSchemas(run.current, run.proposal.schema, libraryNames) : null),
    [run, libraryNames],
  );

  async function analyse() {
    if (!summary || run.status === 'loading') return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSaveError(null);
    setRun({ status: 'loading' });
    const current = summary.currentSchema;
    try {
      const proposal = await requestCoachProposal({
        apiKey: getCoachApiKey(),
        model: getCoachModel(),
        summary,
        goal,
        signal: controller.signal,
      });
      if (controllerRef.current !== controller) return;
      setRun({ status: 'done', proposal, current });
    } catch (e) {
      if (controllerRef.current !== controller) return;
      const error = e instanceof CoachError ? e : new CoachError('invalid-response', 'Er ging iets onverwachts mis. Probeer het opnieuw.');
      setRun({ status: 'error', error });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  async function save() {
    if (run.status !== 'done' || !schema || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const shared = { ...run.proposal.shared };
      if (shared.name.trim().toLowerCase() === schema.name.trim().toLowerCase()) {
        shared.name = `${shared.name} (voorstel Claude)`;
      }
      const newId = await importSharedSchema(shared);
      navigate(`/schemas/${newId}`);
    } catch (e) {
      savingRef.current = false;
      setSaving(false);
      setSaveError(e instanceof Error ? e.message : 'Opslaan is mislukt.');
    }
  }

  const backTo = id ? `/schemas/${id}` : '/schemas';

  if (schema === undefined) {
    return <PageHeader title="Claude-coach" backTo={backTo} />;
  }
  if (schema === null) {
    return (
      <div>
        <PageHeader title="Claude-coach" backTo="/schemas" />
        <p className="px-4 py-3 text-sm text-muted-foreground">Dit schema bestaat niet (meer).</p>
      </div>
    );
  }

  const loading = run.status === 'loading';

  return (
    <div>
      <PageHeader title="Claude-coach" backTo={backTo} />

      <div className="px-4 py-3 space-y-4">
        <p className="text-sm text-muted-foreground">
          Laat Claude je training analyseren en een aangepaste versie van <strong className="text-foreground">{schema.name}</strong> voorstellen.
          Je huidige schema blijft ongewijzigd.
        </p>

        {!hasKey ? (
          <Card className="shadow-none" data-testid="coach-no-key">
            <CardContent className="p-4 space-y-3">
              <p className="flex items-center gap-2 font-medium text-sm">
                <KeyRound className="h-4 w-4 text-primary" />
                Nog geen API-key ingesteld
              </p>
              <p className="text-sm text-muted-foreground">
                Voor deze analyse is een eigen Anthropic API-key nodig. Voeg die toe in Instellingen onder “Claude-coach”.
                Zonder key kun je de samenvatting ook kopiëren naar claude.ai via de schemapagina.
              </p>
              <Button asChild className="w-full">
                <Link to="/settings#claude-coach">Naar Instellingen</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section aria-label="Analyse aanvragen" className="space-y-3">
            <div role="group" aria-label="Periode" className="flex gap-2">
              {PERIODS.map(p => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={weeks === p ? 'default' : 'secondary'}
                  aria-pressed={weeks === p}
                  disabled={loading}
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
              disabled={loading}
              maxLength={500}
              rows={2}
              placeholder="Doel of vraag, bijv. “meer rug” of “knie-vriendelijk” (optioneel)"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <p className="text-xs text-muted-foreground/80">
              Een samenvatting van je training (inclusief je notities, zonder ruwe sets of datums) gaat naar Anthropic ({coachModelLabel(model)}).
            </p>

            {loading ? (
              <div className="space-y-2" data-testid="coach-loading">
                <p role="status" className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claude analyseert je training… dit kan een minuut duren.
                </p>
                <Button type="button" variant="outline" className="w-full" onClick={cancel}>
                  Annuleren
                </Button>
              </div>
            ) : (
              <Button type="button" className="w-full" onClick={() => void analyse()} disabled={!summary}>
                <Sparkles className="h-4 w-4" />
                {run.status === 'done' ? 'Opnieuw analyseren' : 'Analyseer'}
              </Button>
            )}
          </section>
        )}

        {run.status === 'error' && (
          <div role="alert" data-testid="coach-error" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
            <p className="flex items-start gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{run.error.message}</span>
            </p>
            {run.error.details.length > 0 && (
              <ul data-testid="coach-error-details" className="list-disc pl-5 text-xs space-y-0.5">
                {run.error.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            {(run.error.kind === 'unauthorized' || run.error.kind === 'forbidden' || run.error.kind === 'no-key') && (
              <Link to="/settings#claude-coach" className="text-xs underline">Naar Instellingen</Link>
            )}
          </div>
        )}

        {run.status === 'done' && diff && (
          <>
            <section aria-labelledby="coach-analysis-heading" data-testid="coach-analysis">
              <h2 id="coach-analysis-heading" className="text-sm font-medium text-muted-foreground mb-1">Analyse</h2>
              <div className="text-sm whitespace-pre-wrap break-words">{run.proposal.analysis}</div>
            </section>

            <section aria-labelledby="coach-diff-heading" data-testid="coach-diff" className="space-y-3">
              <div>
                <h2 id="coach-diff-heading" className="text-sm font-medium text-muted-foreground">
                  Voorstel: {run.proposal.schema.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {summarizeSharedSchema(run.proposal.shared)} · {diff.counts.added} toegevoegd · {diff.counts.changed} gewijzigd ·{' '}
                  {diff.counts.moved > 0 && `${diff.counts.moved} verplaatst · `}
                  {diff.counts.removed} geschrapt · {diff.counts.unchanged} ongewijzigd
                </p>
              </div>

              {run.proposal.warnings.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium"><TriangleAlert className="h-4 w-4" />Let op</p>
                  <ul className="list-disc pl-5 text-xs space-y-0.5">
                    {run.proposal.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {diff.sections.map((s, i) => (
                <DiffSectionCard key={i} section={s} />
              ))}

              {diff.removedDays.filter(d => d.exercises.length > 0 || d.name !== null).map((d, i) => (
                <Card key={`removed-${i}`} className="shadow-none border-destructive/40" data-testid="coach-removed-day">
                  <CardContent className="p-3 space-y-1">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                      {d.name ?? 'Oefeningen'} <Badge variant="outline" className="ml-1 normal-case">dag geschrapt</Badge>
                    </h3>
                    {d.movedCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {d.movedCount === 1 ? '1 oefening is' : `${d.movedCount} oefeningen zijn`} naar een andere dag verplaatst.
                      </p>
                    )}
                    <ul className="space-y-1">
                      {d.exercises.map((e, ei) => <RemovedRow key={ei} exercise={e} />)}
                    </ul>
                  </CardContent>
                </Card>
              ))}

              {diff.newExercises.length > 0 && (
                <p data-testid="coach-new-exercises" className="text-xs text-muted-foreground">
                  {diff.newExercises.length === 1 ? '1 oefening bestaat nog niet' : `${diff.newExercises.length} oefeningen bestaan nog niet`}{' '}
                  en {diff.newExercises.length === 1 ? 'wordt' : 'worden'} bij opslaan aangemaakt (zonder spiergroepen):{' '}
                  {diff.newExercises.join(', ')}.
                </p>
              )}
            </section>

            <Button className="w-full" onClick={() => void save()} disabled={saving}>
              {saving ? 'Bezig met opslaan…' : 'Als nieuw schema opslaan'}
            </Button>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

const ROW_BADGE: Record<DiffRow['kind'], { label: string; className: string } | null> = {
  added: { label: 'toegevoegd', className: 'border-emerald-500/60 text-emerald-400' },
  changed: { label: 'gewijzigd', className: 'border-amber-500/60 text-amber-400' },
  moved: { label: 'verplaatst', className: 'border-violet-500/60 text-violet-400' },
  unchanged: null,
};

function DiffSectionCard({ section }: { section: DiffSection }) {
  return (
    <Card className="shadow-none" data-testid="coach-diff-section">
      <CardContent className="p-3 space-y-2">
        {section.name !== null && (
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            {section.name}
            {section.isNewDay && <Badge variant="outline" className="ml-2 normal-case">nieuwe dag</Badge>}
            {section.previousName != null && (
              <span className="ml-2 normal-case font-normal">(was {section.previousName})</span>
            )}
          </h3>
        )}
        {section.reason && <p className="text-xs text-muted-foreground italic">{section.reason}</p>}
        <ul className="space-y-2">
          {section.rows.map((r, i) => {
            const badge = ROW_BADGE[r.kind];
            return (
              <li key={i} data-testid="coach-diff-row" data-kind={r.kind} data-exercise={r.exercise.exercise} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0">
                    {r.exercise.exercise}
                    {r.isNewExercise && (
                      <Badge variant="outline" className="ml-2 align-middle border-sky-500/60 text-sky-400">nieuwe oefening</Badge>
                    )}
                    {badge && <Badge variant="outline" className={`ml-2 align-middle ${badge.className}`}>{badge.label}</Badge>}
                    {r.exercise.supersetGroup && (
                      <span className="text-muted-foreground text-xs ml-2">superset {r.exercise.supersetGroup}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {r.change ?? formatPrescription(r.exercise)}
                  </span>
                </div>
                {r.kind === 'moved' && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.fromDay != null ? `Was op dag “${r.fromDay}”.` : 'Stond eerder in de oefeningenlijst.'}
                  </p>
                )}
                {r.exercise.reason && <p className="text-xs text-muted-foreground mt-0.5">{r.exercise.reason}</p>}
              </li>
            );
          })}
          {section.removed.map((e, i) => <RemovedRow key={`r-${i}`} exercise={e} />)}
        </ul>
      </CardContent>
    </Card>
  );
}

function RemovedRow({ exercise }: { exercise: SchemaJsonExercise }) {
  return (
    <li data-testid="coach-diff-row" data-kind="removed" data-exercise={exercise.exercise} className="flex items-baseline justify-between gap-2 text-sm text-muted-foreground">
      <span className="min-w-0 line-through">
        {exercise.exercise}
        <Badge variant="outline" className="ml-2 align-middle no-underline border-destructive/60 text-destructive">geschrapt</Badge>
      </span>
      <span className="text-xs whitespace-nowrap">{formatPrescription(exercise)}</span>
    </li>
  );
}
