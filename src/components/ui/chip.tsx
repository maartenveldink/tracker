import * as React from "react"

import { cn } from "@/lib/utils"

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/**
 * DESIGN §4 chip: pill with a 44px hit area. Toggle semantics via `aria-pressed`.
 * Selected = accent fill; unselected = transparent with a `line-strong` border.
 */
const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected = false, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-touch items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-accent bg-accent font-semibold text-on-accent"
          : "border-line-strong bg-transparent font-medium text-muted hover:text-text",
        className
      )}
      {...props}
    />
  )
)
Chip.displayName = "Chip"

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  /** Required accessible name of the group. */
  "aria-label": string
  className?: string
}

/** DESIGN §4 segmented control (container `surface`, radius 16, padding 4, 40px segments). */
function Segmented<T extends string>({ options, value, onChange, className, ...props }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn("grid gap-1 rounded-button border bg-surface p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(o => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 rounded-[12px] text-small transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected ? "bg-accent font-semibold text-on-accent" : "font-medium text-muted hover:text-text"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export { Chip, Segmented }
