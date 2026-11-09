import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { HabitSchedule, HabitType } from '../../../db/index';
import { createHabit, updateHabit, useHabit } from '../hooks/useHabits';
import { todayISO } from '../../../lib/dateUtils';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';

type ScheduleKind = HabitSchedule['kind'];

const KIND_LABELS: Record<ScheduleKind, string> = {
  daily: 'Dagelijks',
  interval: 'Elke X dagen',
  weekdays: 'Weekdagen',
  monthdays: 'Dag v/d maand',
};

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']; // index 0..6

export function HabitFormPage() {
  const { id } = useParams<{ id: string }>();
  const habitId = id || undefined;
  const existing = useHabit(habitId);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [type, setType] = useState<HabitType>('boolean');
  const [target, setTarget] = useState('8');
  const [unit, setUnit] = useState('');
  const [kind, setKind] = useState<ScheduleKind>('daily');
  const [everyDays, setEveryDays] = useState(2);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthdays, setMonthdays] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Prefill in edit mode once the habit resolves.
  useEffect(() => {
    if (!existing || loaded) return;
    setName(existing.name);
    setEmoji(existing.emoji ?? '');
    setType(existing.type);
    setTarget(existing.target != null ? String(existing.target) : '');
    setUnit(existing.unit ?? '');
    setKind(existing.schedule.kind);
    if (existing.schedule.kind === 'interval') setEveryDays(existing.schedule.everyDays);
    if (existing.schedule.kind === 'weekdays') setWeekdays(existing.schedule.days);
    if (existing.schedule.kind === 'monthdays') setMonthdays(existing.schedule.days);
    setLoaded(true);
  }, [existing, loaded]);

  function toggleIn(list: number[], v: number): number[] {
    return list.includes(v) ? list.filter(x => x !== v) : [...list, v].sort((a, b) => a - b);
  }

  function buildSchedule(): HabitSchedule | null {
    switch (kind) {
      case 'daily':
        return { kind: 'daily' };
      case 'interval':
        return everyDays >= 1
          ? { kind: 'interval', everyDays, anchor: existing?.schedule.kind === 'interval' ? existing.schedule.anchor : todayISO() }
          : null;
      case 'weekdays':
        return weekdays.length > 0 ? { kind: 'weekdays', days: weekdays } : null;
      case 'monthdays':
        return monthdays.length > 0 ? { kind: 'monthdays', days: monthdays } : null;
    }
  }

  // Parsed target: empty text means "no target". Count requires one; amount
  // treats it as optional (leave blank to just track the value).
  const targetText = target.trim();
  const targetNum = targetText === '' ? undefined : Number(targetText);
  const targetOk = targetNum != null && Number.isFinite(targetNum) && targetNum >= 1;

  const schedule = buildSchedule();
  const targetValid =
    type === 'count' ? targetOk : type === 'amount' ? targetText === '' || targetOk : true;
  const valid = name.trim().length > 0 && schedule !== null && targetValid;

  async function save() {
    if (!valid || !schedule) return;
    const input = {
      name: name.trim(),
      emoji: emoji.trim() || undefined,
      type,
      target: type === 'count' || type === 'amount' ? (targetOk ? targetNum : undefined) : undefined,
      unit: type === 'amount' ? unit.trim() || undefined : undefined,
      schedule,
    };
    if (habitId != null) {
      await updateHabit(habitId, input);
      navigate(`/habits/${habitId}`);
    } else {
      await createHabit(input);
      navigate('/habits');
    }
  }

  return (
    <div>
      <PageHeader title={habitId != null ? 'Habit bewerken' : 'Nieuwe habit'} backTo="/habits" />

      <div className="px-screen-x py-5 space-y-6">
        {/* Basis */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              placeholder="🙂"
              maxLength={2}
              aria-label="Emoji"
              className="w-16 px-0 text-center text-lg"
            />
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Naam (bv. 8 glazen water)"
              aria-label="Naam"
              className="flex-1"
            />
          </div>
        </div>

        {/* Type */}
        <div className="space-y-2">
          <p className="text-small font-semibold">Type</p>
          <div className="flex gap-2">
            {(['boolean', 'count', 'amount'] as HabitType[]).map(t => (
              <Chip key={t} selected={type === t} onClick={() => setType(t)}>
                {t === 'boolean' ? 'Aan/uit' : t === 'count' ? 'Teller' : 'Getal'}
              </Chip>
            ))}
          </div>
          {(type === 'count' || type === 'amount') && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-small text-muted">
                  {type === 'amount' ? 'Doel per dag (optioneel)' : 'Doel per dag'}
                </span>
                <Input
                  type="number"
                  min={1}
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder={type === 'amount' ? 'geen' : undefined}
                  aria-label="Doel"
                  className="w-20"
                />
                {type === 'amount' && (
                  <Input
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="eenheid"
                    aria-label="Eenheid"
                    maxLength={8}
                    className="w-24"
                  />
                )}
              </div>
              {type === 'amount' && (
                <p className="text-caption text-muted">
                  Zonder doel houd je de waarde alleen bij, zonder gehaald/niet-gehaald.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Schema */}
        <div className="space-y-2">
          <p className="text-small font-semibold">Schema</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND_LABELS) as ScheduleKind[]).map(k => (
              <Chip key={k} selected={kind === k} onClick={() => setKind(k)} className="px-2">
                {KIND_LABELS[k]}
              </Chip>
            ))}
          </div>

          {kind === 'interval' && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-small text-muted">Elke</span>
              <Input
                type="number"
                min={1}
                value={everyDays}
                onChange={e => setEveryDays(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Aantal dagen"
                className="w-20"
              />
              <span className="text-small text-muted">dagen</span>
            </div>
          )}

          {kind === 'weekdays' && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {WEEKDAYS.map((label, i) => (
                <Chip
                  key={label}
                  selected={weekdays.includes(i)}
                  onClick={() => setWeekdays(prev => toggleIn(prev, i))}
                  className="px-3.5 capitalize"
                >
                  {label}
                </Chip>
              ))}
            </div>
          )}

          {kind === 'monthdays' && (
            <div className="grid grid-cols-7 gap-1.5 pt-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <Chip
                  key={day}
                  selected={monthdays.includes(day)}
                  onClick={() => setMonthdays(prev => toggleIn(prev, day))}
                  className="px-0 text-caption"
                >
                  {day}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* Save */}
        <Button size="lg" className="w-full" onClick={() => void save()} disabled={!valid}>
          {habitId != null ? 'Opslaan' : 'Habit aanmaken'}
        </Button>
      </div>
    </div>
  );
}
