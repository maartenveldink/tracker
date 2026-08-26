import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Archive, Trash2 } from 'lucide-react';
import { useHabit, useHabitLogs, archiveHabit, deleteHabit } from '../hooks/useHabits';
import { doneByDateForHabit, habitStreak, completionRate } from '../lib/schedule';
import { HabitHeatmap } from '../components/HabitHeatmap';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Period = '4w' | '3m' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: '4w', label: '4 weken' },
  { value: '3m', label: '3 maanden' },
  { value: 'all', label: 'Alles' },
];

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const habitId = id ? Number(id) : undefined;
  const habit = useHabit(habitId);
  const logs = useHabitLogs();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<Period>('3m');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doneByDate = useMemo(
    () => (habit ? doneByDateForHabit(habit, logs) : new Map<string, boolean>()),
    [habit, logs],
  );

  const streak = useMemo(
    () => (habit ? habitStreak(habit, doneByDate) : 0),
    [habit, doneByDate],
  );

  const rate = useMemo(() => {
    if (!habit) return 0;
    const to = new Date();
    const from = new Date();
    if (period === '4w') from.setDate(from.getDate() - 28);
    else if (period === '3m') from.setMonth(from.getMonth() - 3);
    else from.setTime(new Date(habit.createdAt).getTime());
    return completionRate(habit, doneByDate, from, to);
  }, [habit, doneByDate, period]);

  if (!habit) {
    return (
      <div>
        <PageHeader title="Habit" backTo="/habits" />
      </div>
    );
  }

  async function handleDelete() {
    setConfirmDelete(false);
    await deleteHabit(habitId!);
    navigate('/habits');
  }

  return (
    <div>
      <PageHeader
        title={`${habit.emoji ? `${habit.emoji} ` : ''}${habit.name}`}
        backTo="/habits"
        actions={
          <Button asChild variant="ghost" size="icon" aria-label="Bewerken">
            <Link to={`/habits/${habit.id}/edit`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="px-4 py-3 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{streak}</div>
              <div className="text-xs text-muted-foreground mt-0.5">dagen streak</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{Math.round(rate * 100)}%</div>
              <div className="text-xs text-muted-foreground mt-0.5">voltooid</div>
            </CardContent>
          </Card>
        </div>

        {/* Period filter */}
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <HabitHeatmap schedule={habit.schedule} doneByDate={doneByDate} />

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => void archiveHabit(habit.id!).then(() => navigate('/habits'))}
          >
            <Archive className="h-4 w-4" /> Archiveren
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" /> Verwijderen
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Habit verwijderen?"
        message="De habit en al zijn logs worden definitief verwijderd."
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
