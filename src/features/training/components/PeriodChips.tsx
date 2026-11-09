import { Chip } from '@/components/ui/chip';
import type { PeriodFilter } from '../hooks/useProgress';

const OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '4w', label: '4 wkn' },
  { value: '3m', label: '3 mnd' },
  { value: 'all', label: 'Alles' },
];

/** Period filter chips (DESIGN: 4 wkn / 3 mnd / Alles). */
export function PeriodChips({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (value: PeriodFilter) => void;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Periode">
      {OPTIONS.map(opt => (
        <Chip key={opt.value} selected={value === opt.value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
