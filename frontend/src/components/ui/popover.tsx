import * as React from "react"
import { cn } from "@/lib/utils"

interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Popover = ({ open, onOpenChange, children }: PopoverProps) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        e.stopPropagation()
        onOpenChange?.(false)
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverContent }
