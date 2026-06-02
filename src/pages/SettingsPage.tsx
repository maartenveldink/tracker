import { useState, useEffect, useRef } from 'react';
import { Trash2, FlaskConical, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

type Feedback = { type: 'success' | 'error'; message: string } | null;

export function SettingsPage() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            Verwijdert alle trainingen, schema's en zelfgemaakte oefeningen. De standaard
            oefeningen worden daarna opnieuw ingeladen.
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
