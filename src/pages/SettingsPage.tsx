import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, CheckCircle2, Calculator, Eye, Download, Upload, Timer, Rows3, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold">Instellingen</h1>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-primary/15 text-primary'
              : 'bg-destructive/15 text-destructive'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {/* E8-01: 1RM formula */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            1RM-formule
          </CardTitle>
          <CardDescription>
            Kies de formule waarmee je geschatte 1 rep max wordt berekend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.oneRMFormula}
            onValueChange={(value: 'epley' | 'brzycki' | 'lombardi') =>
              void updateSettings({ oneRMFormula: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="epley" id="formula-epley" />
              <Label htmlFor="formula-epley" className="flex-1 cursor-pointer">
                <span className="font-medium">Epley</span>
                <span className="block text-xs text-muted-foreground">
                  gewicht x (1 + reps / 30) — standaard
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="brzycki" id="formula-brzycki" />
              <Label htmlFor="formula-brzycki" className="flex-1 cursor-pointer">
                <span className="font-medium">Brzycki</span>
                <span className="block text-xs text-muted-foreground">
                  gewicht x 36 / (37 - reps)
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="lombardi" id="formula-lombardi" />
              <Label htmlFor="formula-lombardi" className="flex-1 cursor-pointer">
                <span className="font-medium">Lombardi</span>
                <span className="block text-xs text-muted-foreground">
                  gewicht x reps^0.1
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* E8-02: Muscle detail level */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Spiergroepniveau
          </CardTitle>
          <CardDescription>
            Kies of je globale spiergroepen (10) of gedetailleerde spieren (20+) wilt zien.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="muscle-detail" className="cursor-pointer">
              {settings.muscleDetailLevel === 'detailed'
                ? 'Gedetailleerd (20+ spieren)'
                : 'Globaal (10 spiergroepen)'}
            </Label>
            <Switch
              id="muscle-detail"
              checked={settings.muscleDetailLevel === 'detailed'}
              onCheckedChange={(checked) =>
                void updateSettings({ muscleDetailLevel: checked ? 'detailed' : 'global' })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Workout density — size/spacing of the live-workout set controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rows3 className="h-4 w-4 text-primary" />
            Weergave training
          </CardTitle>
          <CardDescription>
            Kies hoe groot de knoppen en velden tijdens een training zijn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.workoutDensity}
            onValueChange={(value: 'compact' | 'comfortable' | 'spacious') =>
              void updateSettings({ workoutDensity: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="compact" id="density-compact" />
              <Label htmlFor="density-compact" className="flex-1 cursor-pointer">
                <span className="font-medium">Compact</span>
                <span className="block text-xs text-muted-foreground">
                  Kleine knoppen, meer sets in beeld
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="comfortable" id="density-comfortable" />
              <Label htmlFor="density-comfortable" className="flex-1 cursor-pointer">
                <span className="font-medium">Comfortabel</span>
                <span className="block text-xs text-muted-foreground">
                  Ruimere knoppen en velden — standaard
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="spacious" id="density-spacious" />
              <Label htmlFor="density-spacious" className="flex-1 cursor-pointer">
                <span className="font-medium">Ruim</span>
                <span className="block text-xs text-muted-foreground">
                  Grote knoppen, makkelijk te raken
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Weight increments — step size of the +/- weight buttons per equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            Gewichtsstappen
          </CardTitle>
          <CardDescription>
            Kies per materiaal hoeveel het gewicht op- en afgaat met de +/- knoppen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEIGHT_STEP_EQUIPMENT.map(({ value, label }) => {
            const current = settings.weightSteps[value];
            return (
              <div key={value} className="flex items-center justify-between gap-3">
                <Label htmlFor={`weightstep-${value}`} className="font-medium">
                  {label}
                </Label>
                <select
                  id={`weightstep-${value}`}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={weightStepKey(current)}
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
            );
          })}
        </CardContent>
      </Card>

      {/* RT-05: Rest timer duration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" />
            Rusttimer
          </CardTitle>
          <CardDescription>
            Standaard rustduur na een voltooide set (15s - 10 min, stappen van 15s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={settings.restTimerSeconds <= 15}
              onClick={() =>
                void updateSettings({
                  restTimerSeconds: Math.max(15, settings.restTimerSeconds - 15),
                })
              }
            >
              -
            </Button>
            <div className="flex-1 text-center font-medium">
              {Math.floor(settings.restTimerSeconds / 60)}:{String(settings.restTimerSeconds % 60).padStart(2, '0')}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={settings.restTimerSeconds >= 600}
              onClick={() =>
                void updateSettings({
                  restTimerSeconds: Math.min(600, settings.restTimerSeconds + 15),
                })
              }
            >
              +
            </Button>
          </div>

          {/* Rest defaults per laterality × movement type */}
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Standaard rust per type oefening</p>
              <p className="text-xs text-muted-foreground">
                Voorgestelde rust op basis van belasting en type, wanneer een oefening geen eigen rusttijd heeft (15s - 10 min, stappen van 15s).
              </p>
            </div>
            {([
              { key: 'bilateralCompound', label: 'Bilateraal · compound' },
              { key: 'unilateralCompound', label: 'Unilateraal · compound' },
              { key: 'bilateralIsolation', label: 'Bilateraal · isolatie' },
              { key: 'unilateralIsolation', label: 'Unilateraal · isolatie' },
            ] as const).map(({ key, label }) => {
              const value = settings.restDefaults[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{label}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={value <= 15}
                    onClick={() =>
                      void updateSettings({
                        restDefaults: { ...settings.restDefaults, [key]: Math.max(15, value - 15) },
                      })
                    }
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-medium tabular-nums">
                    {Math.floor(value / 60)}:{String(value % 60).padStart(2, '0')}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={value >= 600}
                    onClick={() =>
                      void updateSettings({
                        restDefaults: { ...settings.restDefaults, [key]: Math.min(600, value + 15) },
                      })
                    }
                  >
                    +
                  </Button>
                </div>
              );
            })}
          </div>

          {/* E3-12: rest timer end alerts */}
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="rest-vibrate" className="cursor-pointer">
                Trillen bij einde rust
              </Label>
              <Switch
                id="rest-vibrate"
                checked={settings.restTimerVibrate}
                onCheckedChange={(checked) => void updateSettings({ restTimerVibrate: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rest-sound" className="cursor-pointer">
                Geluid bij einde rust
              </Label>
              <Switch
                id="rest-sound"
                checked={settings.restTimerSound}
                onCheckedChange={(checked) => void updateSettings({ restTimerSound: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* E8-07: Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Data exporteren
          </CardTitle>
          <CardDescription>
            Download al je data als JSON-bestand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData && (
            <p className="text-sm text-muted-foreground mb-3">
              Er is geen data om te exporteren.
            </p>
          )}
          <Button onClick={() => void handleExport()} disabled={loading || !hasData} className="w-full">
            Exporteer data
          </Button>
        </CardContent>
      </Card>

      {/* E8-08: Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Data importeren
          </CardTitle>
          <CardDescription>
            Importeer een eerder geëxporteerd JSON-bestand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full">
            Importeer data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Gevarenzone
          </CardTitle>
          <CardDescription>
            Verwijdert alle trainingen, schema's, voeding en zelfgemaakte oefeningen. De standaard
            oefeningen worden daarna opnieuw ingeladen. Instellingen worden gereset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setConfirmClear(true)}
            disabled={loading}
            className="w-full"
          >
            Alles wissen
          </Button>
        </CardContent>
      </Card>

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
            <ul className="text-sm space-y-1 px-1">
              {importPreview.workouts.length > 0 && <li>{importPreview.workouts.length} trainingen</li>}
              {importPreview.schemas.length > 0 && <li>{importPreview.schemas.length} schema&apos;s</li>}
              {importPreview.exercises.length > 0 && <li>{importPreview.exercises.length} oefeningen</li>}
              {(importPreview.bodyWeights?.length ?? 0) > 0 && <li>{importPreview.bodyWeights!.length} gewicht-metingen</li>}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
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
            <ul className="text-sm space-y-1 px-1">
              {importResult.workouts > 0 && <li>{importResult.workouts} trainingen</li>}
              {importResult.schemas > 0 && <li>{importResult.schemas} schema&apos;s</li>}
              {importResult.exercises > 0 && <li>{importResult.exercises} oefeningen</li>}
              {importResult.bodyWeights > 0 && <li>{importResult.bodyWeights} gewicht-metingen</li>}
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
