import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Link2, Link2Off, Minus, Plus, RotateCcw, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { groupSupersets, supersetBlocks, type SupersetInfo } from '../lib/superset';
import { supersetLinkAction } from '../lib/exerciseEditCard';

/**
 * Keyboard-free stepper row: label (+ optional caption) on the left, a
 * `– value +` control group on the right. One field per line so the card
 * stays legible on narrow screens.
 */
export function StepperRow({
  label,
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  caption,
  onReset,
}: {
  label: string;
  value: ReactNode;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  caption?: ReactNode;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-small font-medium">{label}</span>
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-touch w-touch shrink-0 text-muted"
              onClick={onReset}
              aria-label={`${label} terug naar suggestie`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
        {caption && <p className="text-caption leading-tight text-muted">{caption}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-touch w-touch rounded-full"
          onClick={onDec}
          disabled={decDisabled}
          aria-label={`${label} verlagen`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-16 select-none text-center text-small font-semibold tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-touch w-touch rounded-full"
          onClick={onInc}
          disabled={incDisabled}
          aria-label={`${label} verhogen`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export interface ExerciseEditCardProps {
  name: string;
  /** Position in the list (0-based); shown as a number outside a superset. */
  index: number;
  total: number;
  info: SupersetInfo | undefined;
  /** Collapsed one-liner, e.g. "3 × 8-12 · rust 1:30" (`exerciseCardSummary`). */
  summary: string;
  /** Optional reason line under the name, visible collapsed and expanded (suggestion). */
  reason?: { text: string; urgent: boolean };
  expanded: boolean;
  onToggle: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onToggleSuperset: () => void;
  /** Extra actions next to the superset button, only when expanded (e.g. swap). */
  actions?: ReactNode;
  /** The editable fields, only when expanded (differs per screen). */
  children: ReactNode;
}

/**
 * Collapsible exercise card shared by the schema editor and the suggested
 * workout: header (number or superset letter, name, summary/reason, up/down,
 * remove); expanded it shows the superset link button, extra actions and the
 * screen's fields.
 */
export function ExerciseEditCard({
  name,
  index,
  total,
  info,
  summary,
  reason,
  expanded,
  onToggle,
  onMove,
  onRemove,
  onToggleSuperset,
  actions,
  children,
}: ExerciseEditCardProps) {
  const linkAction = supersetLinkAction(index, info);
  return (
    <Card data-testid="exercise-edit-card" className="shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-h-touch min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            )}
            {info?.inSuperset ? (
              <span className="w-4 shrink-0 text-center text-caption font-semibold text-primary">{info.label}</span>
            ) : (
              <span className="w-4 shrink-0 text-center text-caption text-muted">{index + 1}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-medium">{name}</span>
              {!expanded && <span className="block truncate text-caption text-muted">{summary}</span>}
              {reason && (
                <span
                  className={cn(
                    'mt-0.5 flex items-start gap-1 text-caption',
                    reason.urgent ? 'text-accent-2' : 'text-muted',
                  )}
                >
                  <Target className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {/* Wraps instead of truncating: on 360 px the header leaves ~100 px for the text. */}
                  <span className="line-clamp-2 break-words">{reason.text}</span>
                </span>
              )}
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-touch w-touch shrink-0 text-muted"
            onClick={() => onMove('up')}
            disabled={index === 0}
            aria-label="Omhoog"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-touch w-touch shrink-0 text-muted"
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            aria-label="Omlaag"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-touch w-touch shrink-0 text-muted hover:text-danger"
            onClick={onRemove}
            aria-label="Verwijderen"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {expanded && (
          <div className="mt-1 border-t border-border/60">
            {(linkAction || actions) && (
              // Own wrapping row so the actions never get clipped on narrow screens.
              <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-border/60 py-1">
                {linkAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn('h-touch px-2 text-caption', linkAction === 'unlink' ? 'text-primary' : 'text-muted')}
                    onClick={onToggleSuperset}
                    aria-label={linkAction === 'unlink' ? 'Superset ontkoppelen' : 'Superset met vorige'}
                    title={linkAction === 'unlink' ? 'Superset ontkoppelen' : 'Koppel als superset met de oefening erboven'}
                  >
                    {linkAction === 'unlink' ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {linkAction === 'unlink' ? 'Ontkoppelen' : 'Superset met vorige'}
                  </Button>
                ) : null}
                {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
              </div>
            )}
            <div className="divide-y divide-border/60">{children}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The list around the cards: single exercises as-is, superset members inside
 * one `superset-group` wrapper with a "Superset" header.
 */
export function ExerciseEditList<T extends { supersetGroup?: string }>({
  items,
  renderCard,
}: {
  items: T[];
  renderCard: (item: T, index: number, info: SupersetInfo) => ReactNode;
}) {
  const infos = groupSupersets(items);
  return (
    <div className="space-y-2">
      {supersetBlocks(items).map(indices => {
        if (indices.length === 1) {
          const i = indices[0]!;
          return renderCard(items[i]!, i, infos[i]!);
        }
        return (
          <div
            key={`ss-${items[indices[0]!]!.supersetGroup}`}
            data-testid="superset-group"
            className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-1.5"
          >
            <div className="flex items-center gap-1 px-1.5 pt-0.5 text-caption font-medium text-primary">
              <Link2 className="h-3 w-3" aria-hidden="true" />
              Superset
            </div>
            {indices.map(i => renderCard(items[i]!, i, infos[i]!))}
          </div>
        );
      })}
    </div>
  );
}
