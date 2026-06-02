"use client"

import { Popover, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw } from "lucide-react"
import { RowWithCells } from "@/lib/types"

interface RowMenuProps {
  row: RowWithCells
  isOpen: boolean
  position: { top: number; left: number } | null
  onClose: () => void
  onDeleteClick: (rowId: number, event: React.MouseEvent) => void
  onRegenerateClick: (rowId: number, event: React.MouseEvent) => void
}

export function RowMenu({ row, isOpen, position, onClose, onDeleteClick, onRegenerateClick }: RowMenuProps) {
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
          onClick={(e) => onRegenerateClick(row.id, e)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </button>
        <button
          onClick={(e) => onDeleteClick(row.id, e)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
          Delete row
        </button>
      </PopoverContent>
    </Popover>
  )
}

interface DeleteRowConfirmDialogProps {
  row: RowWithCells
  isOpen: boolean
  position: { top: number; left: number } | null
  onClose: () => void
  onConfirm: (rowId: number) => void
}

export function DeleteRowConfirmDialog({ row, isOpen, position, onClose, onConfirm }: DeleteRowConfirmDialogProps) {
  if (!isOpen || !position) return null

  // Get primary column value for display
  const primaryCell = row.cells.find((c) => c.column?.is_primary)
  const rowDisplayValue = primaryCell?.value || `Row #${row.id}`

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
            <p className="text-sm font-medium">Delete row?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This will permanently delete &quot;{rowDisplayValue}&quot; and all its data. This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onConfirm(row.id)}>
              Delete
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
