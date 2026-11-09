import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** Class string of the row, for use on a router `<Link>`: `<Link className={listRowClass}>…`. */
export const listRowClass =
  "flex min-h-14 w-full items-center gap-3 rounded-row border bg-surface px-4 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  /** 12px muted subline. */
  subtitle?: React.ReactNode
  /** Left slot (icon/badge). */
  leading?: React.ReactNode
  /** Right slot: value or action. */
  trailing?: React.ReactNode
  /** Show a muted chevron (navigation rows). */
  chevron?: boolean
  /** Dashed `line-strong` border, transparent (e.g. "Vrije training"). */
  dashed?: boolean
  /** Renders a `<button>` when given, otherwise a `<div>`. */
  onClick?: React.MouseEventHandler<HTMLElement>
  disabled?: boolean
}

/** DESIGN §4 list row (min 56 high, radius 14). */
function ListRow({ title, subtitle, leading, trailing, chevron, dashed, onClick, disabled, className, ...props }: ListRowProps) {
  const cls = cn(
    listRowClass,
    dashed && "border-dashed border-line-strong bg-transparent",
    onClick && "cursor-pointer hover:bg-line/40 disabled:opacity-50",
    className
  )
  const content = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-lg font-semibold leading-snug">{title}</span>
        {subtitle && <span className="text-caption text-muted">{subtitle}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} disabled={disabled} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
        {content}
      </button>
    )
  }
  return (
    <div className={cls} {...props}>
      {content}
    </div>
  )
}

export { ListRow }
