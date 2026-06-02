import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
  children: React.ReactNode
  trigger: React.ReactNode
  align?: "left" | "right"
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const DropdownMenu = ({ children, trigger, align = "left" }: DropdownMenuProps) => {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-50 mt-2 min-w-[200px] rounded-md border bg-white shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("py-1", className)} {...props}>
        {children}
      </div>
    )
  }
)
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DropdownMenuItem.displayName = "DropdownMenuItem"

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem }
