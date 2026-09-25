import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * M3's disabled treatment, per variant, never a faded colour (DESIGN.md,
 * "Buttons: disabled is on-surface, not a faded colour"): a button with a
 * container (filled, destructive, tonal) turns it on-surface at 12% with
 * its label and icon on-surface at 38%; an outlined one keeps no fill, its
 * outline on-surface at 12% and its label at 38%; a text or icon button
 * (ghost, link) only its label at 38%. `--foreground` is on-surface. The
 * `disabled:` utilities outrank a caller's own colours, so a button
 * restyled at its call site (`bg-…`, `text-…`, `border-…`) is disabled the
 * same way. A disabled button takes no pointer, so a tooltip saying why is
 * put on a wrapper (`Tooltip` wraps its child in a span).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-foreground/12 disabled:text-foreground/38",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 disabled:bg-foreground/12 disabled:text-foreground/38 dark:disabled:bg-foreground/12",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 disabled:border-foreground/12 disabled:text-foreground/38 dark:disabled:border-foreground/12 dark:disabled:bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-foreground/12 disabled:text-foreground/38",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 disabled:text-foreground/38",
        link: "text-primary underline-offset-4 hover:underline disabled:text-foreground/38",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
