import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, AlertCircle, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/index';
import { importSharedSchema, summarizeSharedSchema } from '../lib/schemaShare';
import {
  parseSchemaJsonText,
  findUnknownExercises,
  formatPrescription,
  type SchemaJsonExercise,
} from '../lib/schemaJson';

/** Paste or upload a schema as JSON, see validation + a summary, then import. */
export function SchemaImportPage() {
  const navigate = useNavigate();
  // undefined while loading, so we don't flag everything as "nieuw" for a moment.
  const exercises = useLiveQuery(() => db.exercises.filter(e => !e.deleted).toArray());
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const result = useMemo(() => (text.trim() === '' ? null : parseSchemaJsonText(text)), [text]);

  const unknown = useMemo(() => {
    if (!result?.ok || !exercises) return new Set<string>();
    return new Set(
      findUnknownExercises(result.schema, exercises.map(e => e.name)).map(n => n.trim().toLowerCase()),
    );
  }, [result, exercises]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    if (fileInput.current) fileInput.current.value = '';
  }

  async function confirmImport() {
    if (!result?.ok) return;
    setBusy(true);
    setImportError(null);
    try {
      const id = await importSharedSchema(result.shared);
      navigate(`/schemas/${id}`);
    } catch (e) {
      setConfirming(false);
      setImportError(e instanceof Error ? e.message : 'Importeren is mislukt.');
    } finally {
      setBusy(false);
    }
  }

  function exerciseRow(e: SchemaJsonExercise, key: string) {
    return (
      <li key={key} className="flex items-baseline justify-between gap-2 text-small">
        <span className="min-w-0 truncate">
          {e.exercise}
          {unknown.has(e.exercise.trim().toLowerCase()) && (
            <Badge variant="outline" className="ml-2 align-middle">nieuw</Badge>
          )}
          {e.supersetGroup && (
            <span className="text-muted text-caption ml-2">superset {e.supersetGroup}</span>
          )}
        </span>
        <span className="text-muted text-caption whitespace-nowrap">{formatPrescription(e)}</span>
      </li>
    );
  }

  return (
    <div>
      <PageHeader title="Importeer schema" backTo="/schemas" />

      <div className="px-screen-x py-3 space-y-3">
        <p className="text-muted text-small">
          Plak een schema als JSON (bijvoorbeeld door een AI gemaakt) of kies een bestand.
        </p>

        <textarea
          aria-label="Schema JSON"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'{\n  "name": "Mijn schema",\n  "exercises": [\n    { "exercise": "Barbell Bench Press", "sets": 3, "reps": 8 }\n  ]\n}'}
          spellCheck={false}
          className="w-full h-48 rounded-row border border-input bg-transparent px-3 py-2 font-mono text-caption placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json,text/plain"
            aria-label="Kies JSON-bestand"
            className="hidden"
            onChange={e => void handleFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <FileUp className="h-4 w-4" />
            Kies bestand
          </Button>
          {text !== '' && (
            <Button variant="ghost" size="sm" onClick={() => setText('')}>
              Wissen
            </Button>
          )}
        </div>

        {result && !result.ok && (
          <div role="alert" className="rounded-row border border-destructive/50 bg-destructive/10 p-3 space-y-1">
            <p className="flex items-center gap-2 text-small font-medium text-danger">
              <AlertCircle className="h-4 w-4" />
              {result.errors.length} {result.errors.length === 1 ? 'fout' : 'fouten'} gevonden
            </p>
            <ul data-testid="import-errors" className="list-disc pl-5 text-small space-y-0.5">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {result?.ok && (
          <>
            {result.warnings.length > 0 && (
              <div className="rounded-row border border-accent-2/50 bg-accent-2/10 p-3 space-y-1">
                <p className="flex items-center gap-2 text-small font-medium">
                  <TriangleAlert className="h-4 w-4" />
                  Let op
                </p>
                <ul data-testid="import-warnings" className="list-disc pl-5 text-small space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <Card className="shadow-none" data-testid="import-summary">
              <CardContent className="p-3 space-y-3">
                <div>
                  <h2 className="font-medium text-small">{result.schema.name}</h2>
                  <p className="text-muted text-caption">{summarizeSharedSchema(result.shared)}</p>
                </div>
                {result.schema.days
                  ? result.schema.days.map((d, di) => (
                      <div key={di}>
                        <h3 className="text-caption font-semibold uppercase text-muted mb-1">{d.name}</h3>
                        <ul className="space-y-1">{d.exercises.map((e, ei) => exerciseRow(e, `${di}-${ei}`))}</ul>
                      </div>
                    ))
                  : (
                      <ul className="space-y-1">
                        {(result.schema.exercises ?? []).map((e, ei) => exerciseRow(e, String(ei)))}
                      </ul>
                    )}
                {result.schema.rotation && (
                  <p className="text-caption text-muted">Ritme: {result.schema.rotation.join(' → ')}</p>
                )}
                {unknown.size > 0 && (
                  <p data-testid="import-unknown" className="text-caption text-muted">
                    {unknown.size === 1 ? '1 oefening bestaat nog niet' : `${unknown.size} oefeningen bestaan nog niet`}{' '}
                    en {unknown.size === 1 ? 'wordt' : 'worden'} aangemaakt (zonder spiergroepen).
                  </p>
                )}
              </CardContent>
            </Card>

            <Button className="w-full" disabled={!exercises} onClick={() => setConfirming(true)}>
              Importeren
            </Button>
          </>
        )}

        {importError && (
          <p role="alert" className="text-small text-danger">{importError}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirming && result?.ok === true}
        title="Schema importeren"
        message={
          result?.ok
            ? `Wil je het schema "${result.schema.name}" toevoegen? (${summarizeSharedSchema(result.shared)})`
            : ''
        }
        confirmLabel={busy ? 'Bezig…' : 'Importeren'}
        onConfirm={() => { if (!busy) void confirmImport(); }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
