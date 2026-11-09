import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100, clamped. */
  value: number
  /** `accent` for progress/goal, `accent-2` for data and the rest timer. */
  tone?: "accent" | "accent-2"
  /** Track height in px: 8 (default) or 4 for the rest-timer strip. */
  thickness?: 4 | 8
  /** Required accessible name (e.g. "Doel 80%"). */
  "aria-label": string
}

/** DESIGN §4 progress bar: radius 4, `line` track. */
function Progress({ value, tone = "accent", thickness = 8, className, ...props }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "w-full overflow-hidden rounded bg-line",
        thickness === 4 ? "h-1" : "h-2",
        className
      )}
      {...props}
    >
      <div
        className={cn("h-full rounded", tone === "accent" ? "bg-accent" : "bg-accent-2")}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
