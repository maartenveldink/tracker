import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValueColumnProps {
  label: string;
  testId: string;
  inputMode: 'decimal' | 'numeric';
  value: string;
  onChange: (text: string) => void;
  onStep: (dir: 1 | -1) => void;
  minusLabel: string;
  plusLabel: string;
  invalid: boolean;
}

/** One column of the set card: label, big typeable value, − and + below. */
function ValueColumn({ label, testId, inputMode, value, onChange, onStep, minusLabel, plusLabel, invalid }: ValueColumnProps) {
  const btn =
    'flex h-[52px] min-w-touch max-w-[66px] flex-1 items-center justify-center rounded-button bg-line text-text transition-colors hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <label htmlFor={testId} className="text-small text-muted">
        {label}
      </label>
      {/* The value stays typeable (keyboard entry), styled as the big design value. */}
      <input
        type="text"
        inputMode={inputMode}
        id={testId}
        data-testid={testId}
        aria-invalid={invalid || undefined}
        value={value}
        placeholder="–"
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        className={cn(
          'w-full min-w-0 rounded-row bg-transparent text-center font-display text-stepper font-bold leading-[1.15] text-text outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring',
          invalid && 'ring-2 ring-destructive',
        )}
      />
      <div className="mt-2 flex w-full justify-center gap-2">
        <button type="button" aria-label={minusLabel} className={btn} onClick={() => onStep(-1)}>
          <Minus className="h-6 w-6" aria-hidden="true" />
        </button>
        <button type="button" aria-label={plusLabel} className={btn} onClick={() => onStep(1)}>
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface LiveSetCardProps {
  weightText: string;
  repsText: string;
  onWeightChange: (text: string) => void;
  onRepsChange: (text: string) => void;
  onStepWeight: (dir: 1 | -1) => void;
  onStepReps: (dir: 1 | -1) => void;
  /** Weight increment as text ("2,5"), for the aria-labels. */
  stepLabel: string;
  inputError: 'weight' | 'reps' | null;
}

/**
 * DESIGN §4 "Set-kaart": two columns (Gewicht, Herhalingen) with a 1px divider
 * and large steppers. No header line: the set number lives in the dots.
 */
export function LiveSetCard({
  weightText,
  repsText,
  onWeightChange,
  onRepsChange,
  onStepWeight,
  onStepReps,
  stepLabel,
  inputError,
}: LiveSetCardProps) {
  return (
    <div className="mt-1.5 rounded-[24px] border border-line bg-surface px-4 pb-4 pt-[18px]">
      <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-3">
        <ValueColumn
          label="Gewicht (kg)"
          testId="weight-input"
          inputMode="decimal"
          value={weightText}
          onChange={onWeightChange}
          onStep={onStepWeight}
          minusLabel={`Gewicht ${stepLabel} kg minder`}
          plusLabel={`Gewicht ${stepLabel} kg meer`}
          invalid={inputError === 'weight'}
        />
        <div className="bg-line" aria-hidden="true" />
        <ValueColumn
          label="Herhalingen"
          testId="reps-input"
          inputMode="numeric"
          value={repsText}
          onChange={text => onRepsChange(text.replace(/\D/g, ''))}
          onStep={onStepReps}
          minusLabel="Eén herhaling minder"
          plusLabel="Eén herhaling meer"
          invalid={inputError === 'reps'}
        />
      </div>
    </div>
  );
}
