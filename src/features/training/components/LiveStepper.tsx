import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveStepperProps {
  label: string;
  value: string;
  placeholder?: string;
  inputMode: 'decimal' | 'numeric';
  minusLabel: string;
  plusLabel: string;
  onChange: (text: string) => void;
  onStep: (dir: 1 | -1) => void;
  invalid?: boolean;
  testId: string;
}

/** DESIGN §4 "Stapper": `44 | 1fr | 44` grid, value is typeable (keyboard entry stays possible). */
export function LiveStepper({
  label,
  value,
  placeholder = '–',
  inputMode,
  minusLabel,
  plusLabel,
  onChange,
  onStep,
  invalid,
  testId,
}: LiveStepperProps) {
  const btn =
    'flex h-[52px] w-11 items-center justify-center rounded-[12px] bg-line text-text transition-colors hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={testId} className="text-center text-caption text-muted">
        {label}
      </label>
      <div
          className={cn(
            'grid grid-cols-[44px_minmax(0,1fr)_44px] items-center rounded-[16px] bg-bg p-1',
            invalid && 'ring-2 ring-destructive',
          )}
        >
          <button type="button" aria-label={minusLabel} className={btn} onClick={() => onStep(-1)}>
            <Minus className="!size-6" aria-hidden="true" />
          </button>
          <input
            type="text"
            inputMode={inputMode}
            id={testId}
            data-testid={testId}
            aria-invalid={invalid || undefined}
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            onFocus={e => e.target.select()}
            className="w-full min-w-0 bg-transparent text-center font-display text-stepper font-bold text-text outline-none placeholder:text-muted"
          />
          <button type="button" aria-label={plusLabel} className={btn} onClick={() => onStep(1)}>
            <Plus className="!size-6" aria-hidden="true" />
          </button>
      </div>
    </div>
  );
}
