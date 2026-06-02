import { useNavigate } from 'react-router-dom';
import { useSchemas } from '../hooks/useSchemas';
import { useActiveWorkout, startWorkout } from '../hooks/useWorkout';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Zap, Play } from 'lucide-react';
import type { WorkoutExercise, WorkoutSet } from '../db/index';

export function StartWorkoutPage() {
  const schemas = useSchemas();
  const activeWorkout = useActiveWorkout();
  const navigate = useNavigate();

  // If there's an active workout, allow resuming
  if (activeWorkout) {
    return (
      <div>
        <PageHeader title="Training" />
        <div className="px-4 py-8 text-center space-y-4">
          <p className="text-muted-foreground">
            Je hebt een {activeWorkout.status === 'paused' ? 'gepauzeerde' : 'actieve'} training.
          </p>
          <Button
            size="lg"
            onClick={() => navigate(`/workout/${activeWorkout.id}`)}
          >
            <Play className="h-4 w-4" />
            {activeWorkout.status === 'paused' ? 'Hervat training' : 'Ga naar training'}
          </Button>
        </div>
      </div>
    );
  }

  async function handleStartFromSchema(schemaId: number, schemaName: string) {
    const schema = schemas.find(s => s.id === schemaId);
    if (!schema) return;

    const exercises: WorkoutExercise[] = schema.exercises.map((se, order) => ({
      exerciseId: se.exerciseId,
      order,
      sets: Array.from({ length: se.sets }, (_, i): WorkoutSet => ({
        exerciseId: se.exerciseId,
        setNumber: i + 1,
        plannedReps: se.repsPerSet,
        actualReps: null,
        weight: null,
        completed: false,
        skipped: false,
      })),
      notes: '',
    }));

    const workoutId = await startWorkout(schemaId, schemaName, exercises);
    navigate(`/workout/${workoutId}`);
  }

  async function handleStartAdHoc() {
    const workoutId = await startWorkout(null, null, []);
    navigate(`/workout/${workoutId}`);
  }

  return (
    <div>
      <PageHeader title="Start training" />

      <div className="px-4 py-4 space-y-4">
        {/* Ad-hoc option (E3-01) */}
        <Card
          className="shadow-none cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={handleStartAdHoc}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Losse training</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Start zonder schema, voeg oefeningen toe tijdens het trainen</p>
            </div>
          </CardContent>
        </Card>

        {/* Schema options (E3-01) */}
        {schemas.length > 0 && (
          <>
            <Separator />
            <h2 className="text-sm font-medium text-muted-foreground">Vanuit schema</h2>
            <div className="space-y-2">
              {schemas.map(schema => (
                <Card
                  key={schema.id}
                  className="shadow-none cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleStartFromSchema(schema.id!, schema.name)}
                >
                  <CardContent className="p-4">
                    <h3 className="font-medium text-sm">{schema.name}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {schema.exercises.length} oefening{schema.exercises.length !== 1 ? 'en' : ''}
                      {' | '}
                      {schema.exercises.reduce((sum, e) => sum + e.sets, 0)} sets
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {schemas.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">
            Maak eerst een schema aan om vanuit een schema te starten.
          </p>
        )}
      </div>
    </div>
  );
}
