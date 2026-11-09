import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * DESIGN §4. `default` is the primary action (accent fill): use size `lg` (56)
 * for the one main action of a screen and `xl` (64) for "Set klaar" /
 * "Volgende oefening". `secondary` (alias `outline`) is the bordered button,
 * `ghost` the text button (muted), `link` the accent text button.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary:
          "border border-line-strong bg-transparent text-text hover:bg-line/60",
        outline:
          "border border-line-strong bg-transparent text-text hover:bg-line/60",
        ghost: "bg-transparent text-muted hover:text-text",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-touch rounded-row px-4 text-small",
        sm: "h-9 rounded-chip px-3 text-caption",
        lg: "h-button rounded-button px-6 text-body-lg",
        xl: "h-button-train rounded-[18px] px-6 text-[19px] font-bold",
        icon: "h-touch w-touch rounded-row",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
