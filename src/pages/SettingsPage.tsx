import { useState, useEffect, useRef } from 'react';
import { Trash2, FlaskConical, CheckCircle2, Calculator, Eye, Target } from 'lucide-react';
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

type Feedback = { type: 'success' | 'error'; message: string } | null;

export function SettingsPage() {
  const settings = useSettings();

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    </div>
  );
}
