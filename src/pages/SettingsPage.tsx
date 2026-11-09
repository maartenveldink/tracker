import { useState, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clearAllData } from '@/features/training/db/seedDemoWorkouts';
import { AccountCard } from '@/features/auth/AccountCard';
import { useSettings, updateSettings } from '@/hooks/useSettings';
import {
  WEIGHT_STEP_PRESETS,
  weightStepKey,
  weightStepLabel,
} from '@/features/training/lib/weightStep';
import type { Equipment, WeightStepSetting } from '@/db/index';
import { exportAllData, downloadExport, hasExportableData } from '@/lib/exportData';
import { validateExport, importData, type ImportMode, type ImportResult } from '@/lib/importData';
import type { TrackerExport } from '@/lib/exportData';

type Feedback = { type: 'success' | 'error'; message: string } | null;

/** Equipment types shown in the weight-increment settings, with their labels. */
const WEIGHT_STEP_EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'cable', label: 'Cable' },
  { value: 'dumbbell', label: 'Halter' },
  { value: 'plates', label: 'Schijven / barbell' },
  { value: 'other', label: 'Overig' },
];

const WEIGHT_STEP_OPTIONS = WEIGHT_STEP_PRESETS.map((step) => ({
  key: weightStepKey(step),
  step,
  label: weightStepLabel(step),
}));

function findPresetByKey(key: string): WeightStepSetting | undefined {
  return WEIGHT_STEP_OPTIONS.find((o) => o.key === key)?.step;
}

/** Settings group: uppercase label above one card whose rows are separated by hairlines (DESIGN Instellingen). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="px-0.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
      <Card className="divide-y divide-line px-4">{children}</Card>
    </section>
  );
}

/** One row: label (+ optional hint) on the left, control on the right. */
function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-body">{label}</div>
        {hint && <div className="text-caption text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Row whose label is bound to a control through `htmlFor`. */
function FieldRow({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <Row
      label={
        <Label htmlFor={id} className="cursor-pointer text-body font-normal">
          {label}
        </Label>
      }
      hint={hint}
    >
      {children}
    </Row>
  );
}

/** Row group containing a radio group (a block of options under one title). */
function OptionBlock({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="py-3 space-y-3">
      <div>
        <p className="text-body">{title}</p>
        {hint && <p className="text-caption text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function RadioOption({ value, id, label, hint }: { value: string; id: string; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="font-medium">{label}</span>
        <span className="block text-caption font-normal text-muted">{hint}</span>
      </Label>
    </div>
  );
}

function formatSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** − / value / + control for a duration in seconds, in 15s steps. */
function DurationStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label={`${label} verlagen`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 15))}
      >
        -
      </Button>
      <span className="w-12 text-center font-medium tabular-nums">{formatSeconds(value)}</span>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label={`${label} verhogen`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 15))}
      >
        +
      </Button>
    </div>
  );
}

const REST_DEFAULT_ROWS = [
  { key: 'bilateralCompound', label: 'Bilateraal · compound' },
  { key: 'unilateralCompound', label: 'Unilateraal · compound' },
  { key: 'bilateralIsolation', label: 'Bilateraal · isolatie' },
  { key: 'unilateralIsolation', label: 'Unilateraal · isolatie' },
] as const;

export function SettingsPage() {
  const settings = useSettings();

  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export/Import state — reactive: re-evaluates whenever any relevant table changes
  const hasData = useLiveQuery(hasExportableData) ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<TrackerExport | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const flash = (type: 'success' | 'error', message: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ type, message });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
  };

  const handleClear = async () => {
    setConfirmClear(false);
    setLoading(true);
    try {
      await clearAllData();
      flash('success', 'Alle data gewist. Oefeningen zijn opnieuw ingeladen.');
    } catch {
      flash('error', 'Er ging iets mis bij het wissen.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await exportAllData();
      downloadExport(data);
      flash('success', 'Export gedownload.');
    } catch {
      flash('error', 'Export mislukt.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw: unknown = JSON.parse(reader.result as string);
        const validated = validateExport(raw);
        setImportPreview(validated);
      } catch (err) {
        flash('error', err instanceof Error ? err.message : 'Ongeldig bestand.');
      }
    };
    reader.onerror = () => flash('error', 'Bestand kon niet worden gelezen.');
    reader.readAsText(file);
  };

  const handleImport = async (mode: ImportMode) => {
    if (!importPreview) return;
    setImportPreview(null);
    setLoading(true);
    try {
      const result = await importData(importPreview, mode);
      setImportResult(result);
      flash('success', 'Import geslaagd.');
    } catch {
      flash('error', 'Import mislukt. Bestaande data is niet gewijzigd.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-screen-x pt-6 pb-4 space-y-gap">
      <h1 className="px-0.5 font-display text-screen font-bold tracking-tight">Instellingen</h1>

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-row px-4 py-3 text-small font-medium ${
            feedback.type === 'success'
              ? 'bg-primary/15 text-primary'
              : 'bg-destructive/15 text-destructive'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {/* Group "Training". New training toggles are added as <FieldRow> + <Switch> here. */}
      <Section title="Training">
        <OptionBlock title="1RM-formule" hint="Waarmee je geschatte 1 rep max wordt berekend.">
          <RadioGroup
            value={settings.oneRMFormula}
            onValueChange={(value: 'epley' | 'brzycki' | 'lombardi') =>
              void updateSettings({ oneRMFormula: value })
            }
          >
            <RadioOption value="epley" id="formula-epley" label="Epley" hint="gewicht x (1 + reps / 30) — standaard" />
            <RadioOption value="brzycki" id="formula-brzycki" label="Brzycki" hint="gewicht x 36 / (37 - reps)" />
            <RadioOption value="lombardi" id="formula-lombardi" label="Lombardi" hint="gewicht x reps^0.1" />
          </RadioGroup>
        </OptionBlock>

        <FieldRow
          id="muscle-detail"
          label="Spiergroepniveau"
          hint={
            settings.muscleDetailLevel === 'detailed'
              ? 'Gedetailleerd (20+ spieren)'
              : 'Globaal (10 spiergroepen)'
          }
        >
          <Switch
            id="muscle-detail"
            checked={settings.muscleDetailLevel === 'detailed'}
            onCheckedChange={(checked) =>
              void updateSettings({ muscleDetailLevel: checked ? 'detailed' : 'global' })
            }
          />
        </FieldRow>

        <OptionBlock title="Weergave training" hint="Hoe groot de knoppen en velden tijdens een training zijn.">
          <RadioGroup
            value={settings.workoutDensity}
            onValueChange={(value: 'compact' | 'comfortable' | 'spacious') =>
              void updateSettings({ workoutDensity: value })
            }
          >
            <RadioOption value="compact" id="density-compact" label="Compact" hint="Kleine knoppen, meer sets in beeld" />
            <RadioOption value="comfortable" id="density-comfortable" label="Comfortabel" hint="Ruimere knoppen en velden — standaard" />
            <RadioOption value="spacious" id="density-spacious" label="Ruim" hint="Grote knoppen, makkelijk te raken" />
          </RadioGroup>
        </OptionBlock>

        <OptionBlock title="Gewichtsstappen" hint="Hoeveel het gewicht per materiaal op- en afgaat met de +/- knoppen.">
          <div className="space-y-2">
            {WEIGHT_STEP_EQUIPMENT.map(({ value, label }) => (
              <div key={value} className="flex items-center justify-between gap-3">
                <Label htmlFor={`weightstep-${value}`} className="font-medium">
                  {label}
                </Label>
                <select
                  id={`weightstep-${value}`}
                  className="h-11 rounded-row border border-line-strong bg-bg px-3 text-small"
                  value={weightStepKey(settings.weightSteps[value])}
                  onChange={(e) => {
                    const preset = findPresetByKey(e.target.value);
                    if (!preset) return;
                    void updateSettings({
                      weightSteps: { ...settings.weightSteps, [value]: preset },
                    });
                  }}
                >
                  {WEIGHT_STEP_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </OptionBlock>

        <Row label="Rusttimer" hint="Standaard rustduur na een voltooide set (15s - 10 min)">
          <DurationStepper
            label="Rusttimer"
            value={settings.restTimerSeconds}
            min={15}
            max={600}
            onChange={(restTimerSeconds) => void updateSettings({ restTimerSeconds })}
          />
        </Row>

        <OptionBlock
          title="Standaard rust per type oefening"
          hint="Voorgestelde rust op basis van belasting en type, wanneer een oefening geen eigen rusttijd heeft (15s - 10 min)."
        >
          <div className="space-y-2">
            {REST_DEFAULT_ROWS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-small">{label}</span>
                <DurationStepper
                  label={label}
                  value={settings.restDefaults[key]}
                  min={15}
                  max={600}
                  onChange={(seconds) =>
                    void updateSettings({ restDefaults: { ...settings.restDefaults, [key]: seconds } })
                  }
                />
              </div>
            ))}
          </div>
        </OptionBlock>

        <FieldRow id="rest-vibrate" label="Trillen bij einde rust" hint="Alleen op apparaten die dit ondersteunen">
          <Switch
            id="rest-vibrate"
            checked={settings.restTimerVibrate}
            onCheckedChange={(checked) => void updateSettings({ restTimerVibrate: checked })}
          />
        </FieldRow>
        <FieldRow id="rest-sound" label="Geluid bij einde rust">
          <Switch
            id="rest-sound"
            checked={settings.restTimerSound}
            onCheckedChange={(checked) => void updateSettings({ restTimerSound: checked })}
          />
        </FieldRow>

        <FieldRow id="celebration" label="Viering bij verbetering" hint="Confetti en vuurwerk als een oefening beter was dan vorige keer">
          <Switch
            id="celebration"
            checked={settings.celebrationEnabled}
            onCheckedChange={(checked) => void updateSettings({ celebrationEnabled: checked })}
          />
        </FieldRow>
        <FieldRow id="celebration-vibrate" label="Trillen bij viering" hint="Alleen op apparaten die dit ondersteunen">
          <Switch
            id="celebration-vibrate"
            checked={settings.celebrationVibrate}
            disabled={!settings.celebrationEnabled}
            onCheckedChange={(checked) => void updateSettings({ celebrationVibrate: checked })}
          />
        </FieldRow>

        <Row
          label="Wisseltijd tussen oefeningen"
          hint="Opruimen en klaarzetten; telt mee in de geschatte duur van een schema (0 - 5 min)"
        >
          <DurationStepper
            label="Wisseltijd"
            value={settings.exerciseTransitionSeconds}
            min={0}
            max={300}
            onChange={(exerciseTransitionSeconds) => void updateSettings({ exerciseTransitionSeconds })}
          />
        </Row>
      </Section>

      {/* Group "Gegevens" */}
      <Section title="Gegevens">
        <Row
          label="Data exporteren"
          hint={hasData ? 'Download al je data als JSON-bestand' : 'Er is geen data om te exporteren.'}
        >
          <Button variant="secondary" onClick={() => void handleExport()} disabled={loading || !hasData}>
            Exporteer data
          </Button>
        </Row>
        <Row label="Data importeren" hint="Importeer een eerder geëxporteerd JSON-bestand">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            Importeer data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
        </Row>
        <Row
          label={<span className="text-destructive">Alle data wissen</span>}
          hint="Verwijdert alle trainingen, schema's, habits en zelfgemaakte oefeningen. Standaard oefeningen worden opnieuw ingeladen; instellingen worden gereset."
        >
          <Button variant="destructive" onClick={() => setConfirmClear(true)} disabled={loading}>
            Alles wissen
          </Button>
        </Row>
      </Section>

      {/* Account + sync status */}
      <AccountCard />

      {/* Confirm: clear */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alles wissen?</DialogTitle>
            <DialogDescription>
              Dit verwijdert alle trainingen, schema's en zelfgemaakte oefeningen permanent.
              De actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Annuleren
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Ja, alles wissen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <Dialog open={importPreview !== null} onOpenChange={(open) => { if (!open) setImportPreview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data importeren</DialogTitle>
            <DialogDescription>
              Het bestand bevat de volgende data:
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <ul className="text-small space-y-1 px-1">
              {importPreview.workouts.length > 0 && <li>{importPreview.workouts.length} trainingen</li>}
              {importPreview.schemas.length > 0 && <li>{importPreview.schemas.length} schema&apos;s</li>}
              {importPreview.exercises.length > 0 && <li>{importPreview.exercises.length} oefeningen</li>}
              {(importPreview.bodyWeights?.length ?? 0) > 0 && <li>{importPreview.bodyWeights!.length} gewicht-metingen</li>}
              {(importPreview.habits?.length ?? 0) > 0 && <li>{importPreview.habits!.length} habits</li>}
            </ul>
          )}
          <p className="text-small text-muted">
            Kies een importmodus:
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => void handleImport('replace')}
            >
              Vervangen (wis bestaande data)
            </Button>
            <Button
              className="w-full"
              onClick={() => void handleImport('merge')}
            >
              Samenvoegen (voeg toe aan bestaande data)
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setImportPreview(null)}>
              Annuleren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import result dialog */}
      <Dialog open={importResult !== null} onOpenChange={(open) => { if (!open) setImportResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import voltooid</DialogTitle>
            <DialogDescription>
              De volgende data is geïmporteerd:
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <ul className="text-small space-y-1 px-1">
              {importResult.workouts > 0 && <li>{importResult.workouts} trainingen</li>}
              {importResult.schemas > 0 && <li>{importResult.schemas} schema&apos;s</li>}
              {importResult.exercises > 0 && <li>{importResult.exercises} oefeningen</li>}
              {importResult.bodyWeights > 0 && <li>{importResult.bodyWeights} gewicht-metingen</li>}
              {importResult.habits > 0 && <li>{importResult.habits} habits</li>}
            </ul>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResult(null)}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
