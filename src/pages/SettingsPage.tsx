import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Trash2, FlaskConical, CheckCircle2, Calculator, Eye, Target, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { clearAllData, seedDemoData } from '@/features/training/db/seedDemoWorkouts';
import { db } from '@/db/index';
import { useSettings, updateSettings } from '@/hooks/useSettings';
import { exportAllData, downloadExport, hasExportableData } from '@/lib/exportData';
import { validateExport, importData, type ImportMode, type ImportResult } from '@/lib/importData';
import type { TrackerExport } from '@/lib/exportData';

type Feedback = { type: 'success' | 'error'; message: string } | null;

export function SettingsPage() {
  const settings = useSettings();

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export/Import state
  const [hasData, setHasData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<TrackerExport | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Macro goals local drafts (flush on blur)
  const [calDraft, setCalDraft] = useState('');
  const [proteinDraft, setProteinDraft] = useState('');
  const [carbsDraft, setCarbsDraft] = useState('');
  const [fatDraft, setFatDraft] = useState('');
  const macroInitialized = useRef(false);

  useEffect(() => {
    if (!macroInitialized.current && settings.macroGoals) {
      macroInitialized.current = true;
      setCalDraft(settings.macroGoals.calories?.toString() ?? '');
      setProteinDraft(settings.macroGoals.protein?.toString() ?? '');
      setCarbsDraft(settings.macroGoals.carbs?.toString() ?? '');
      setFatDraft(settings.macroGoals.fat?.toString() ?? '');
    }
  }, [settings.macroGoals]);

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
      macroInitialized.current = false;
      flash('success', 'Alle data gewist. Oefeningen zijn opnieuw ingeladen.');
    } catch {
      flash('error', 'Er ging iets mis bij het wissen.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    setConfirmSeed(false);
    setLoading(true);
    try {
      const workoutCount = await db.workouts.count();
      if (workoutCount > 0) {
        flash('error', 'Er is al trainingsdata aanwezig. Wis eerst alle data.');
        setLoading(false);
        return;
      }
      await seedDemoData();
      flash('success', 'Demodata geladen: schema "Push A" + 13 bench press sessies.');
    } catch {
      flash('error', 'Er ging iets mis bij het laden van demodata.');
    } finally {
      setLoading(false);
    }
  };

  function flushMacroGoals(field: 'calories' | 'protein' | 'carbs' | 'fat', value: string) {
    const parsed = value === '' ? null : parseFloat(value);
    const numValue = parsed !== null && !isNaN(parsed) && parsed > 0 ? parsed : null;
    void updateSettings({
      macroGoals: {
        ...settings.macroGoals,
        [field]: numValue,
      },
    });
  }

  // Check whether there is data to export
  useEffect(() => {
    void hasExportableData().then(setHasData);
  }, []);

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
      // Refresh exportable-data check
      void hasExportableData().then(setHasData);
      if (mode === 'replace') {
        macroInitialized.current = false;
      }
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

      {/* E8-03: Macro goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Macrodoelen
          </CardTitle>
          <CardDescription>
            Stel dagelijkse macro-doelen in. Laat leeg om geen doel te gebruiken.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="goal-calories" className="text-xs">Calorieen (kcal)</Label>
              <Input
                id="goal-calories"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={calDraft}
                onChange={e => setCalDraft(e.target.value)}
                onBlur={() => flushMacroGoals('calories', calDraft)}
                placeholder="-"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-protein" className="text-xs">Eiwitten (g)</Label>
              <Input
                id="goal-protein"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={proteinDraft}
                onChange={e => setProteinDraft(e.target.value)}
                onBlur={() => flushMacroGoals('protein', proteinDraft)}
                placeholder="-"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-carbs" className="text-xs">Koolhydraten (g)</Label>
              <Input
                id="goal-carbs"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={carbsDraft}
                onChange={e => setCarbsDraft(e.target.value)}
                onBlur={() => flushMacroGoals('carbs', carbsDraft)}
                placeholder="-"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-fat" className="text-xs">Vetten (g)</Label>
              <Input
                id="goal-fat"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={fatDraft}
                onChange={e => setFatDraft(e.target.value)}
                onBlur={() => flushMacroGoals('fat', fatDraft)}
                placeholder="-"
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

      {/* Demo data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Demodata
          </CardTitle>
          <CardDescription>
            Laad een voorbeeldschema en 13 bench press sessies om de app te verkennen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setConfirmSeed(true)}
            disabled={loading}
            className="w-full"
          >
            Laad demodata
          </Button>
        </CardContent>
      </Card>

      <Separator />

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

      {/* Confirm: seed */}
      <Dialog open={confirmSeed} onOpenChange={setConfirmSeed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demodata laden?</DialogTitle>
            <DialogDescription>
              Dit voegt een schema "Push A" en 13 bench press sessies toe. Werkt alleen als er
              nog geen trainingsdata aanwezig is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSeed(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSeedDemo}>Laden</Button>
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
              {importPreview.foods.length > 0 && <li>{importPreview.foods.length} voedingsmiddelen</li>}
              {importPreview.recipes.length > 0 && <li>{importPreview.recipes.length} recepten</li>}
              {importPreview.dailyLog.length > 0 && <li>{importPreview.dailyLog.length} daglog-items</li>}
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
              {importResult.foods > 0 && <li>{importResult.foods} voedingsmiddelen</li>}
              {importResult.recipes > 0 && <li>{importResult.recipes} recepten</li>}
              {importResult.dailyLog > 0 && <li>{importResult.dailyLog} daglog-items</li>}
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
