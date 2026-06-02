import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  closeOnClickOutside?: boolean
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children, closeOnClickOutside = true }: DialogProps) => {
  if (!open) return null

  const handleBackdropClick = () => {
    if (closeOnClickOutside) {
      onOpenChange?.(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleBackdropClick}>
      <div className="fixed inset-0 bg-black/50" />
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
)
DialogTitle.displayName = "DialogTitle"

const DialogClose = ({
  className,
  onClose,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & { onClose?: () => void }) => (
  <button
    type="button"
    className={cn(
      "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      className
    )}
    onClick={onClose}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </button>
)
DialogClose.displayName = "DialogClose"

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose }
