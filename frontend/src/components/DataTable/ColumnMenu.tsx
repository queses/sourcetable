"use client"

import { Popover, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw } from "lucide-react"
import { Column } from "@/lib/types"

interface ColumnMenuProps {
  column: Column
  isOpen: boolean
  position: { top: number; left: number } | null
  onClose: () => void
  onDeleteClick: (columnId: number, event: React.MouseEvent) => void
  onRegenerateClick: (columnId: number, event: React.MouseEvent) => void
}

export function ColumnMenu({ column, isOpen, position, onClose, onDeleteClick, onRegenerateClick }: ColumnMenuProps) {
  if (!isOpen || !position) return null

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverContent
        className="w-40 p-1"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <button
          onClick={(e) => onRegenerateClick(column.id, e)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </button>
        <button
          onClick={(e) => onDeleteClick(column.id, e)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
          Delete column
        </button>
      </PopoverContent>
    </Popover>
  )
}

interface DeleteColumnConfirmDialogProps {
  column: Column
  isOpen: boolean
  position: { top: number; left: number } | null
  onClose: () => void
  onConfirm: (columnId: number) => void
}

export function DeleteColumnConfirmDialog({
  column,
  isOpen,
  position,
  onClose,
  onConfirm,
}: DeleteColumnConfirmDialogProps) {
  if (!isOpen || !position) return null

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverContent
        className="w-64 p-4"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Delete column?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This will permanently delete &quot;{column.title}&quot; and all its data. This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onConfirm(column.id)}>
              Delete
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
