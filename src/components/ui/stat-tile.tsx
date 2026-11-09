import * as React from "react"

import { cn } from "@/lib/utils"

interface StatTileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: string
  value: React.ReactNode
  /** Optional delta line in `accent-2`, e.g. "↑ 12% t.o.v. vorige week". */
  delta?: React.ReactNode
  /** Optional trailing element (e.g. a "+ Log" button). */
  action?: React.ReactNode
}

/** DESIGN §4 stat tile (radius 18, padding 14). Put three in a `grid grid-cols-3 gap-gap`. */
function StatTile({ label, value, delta, action, className, ...props }: StatTileProps) {
  return (
    <div
      className={cn("rounded-tile border bg-surface p-3.5", className)}
      {...props}
    >
      <p className="font-display text-stat font-bold leading-tight">{value}</p>
      <p className="text-caption text-muted">{label}</p>
      {delta && <p className="mt-0.5 text-caption text-accent-2">{delta}</p>}
      {action}
    </div>
  )
}

export { StatTile }
