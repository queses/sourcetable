"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ColumnTypeEnum, Column } from "@/lib/types"

interface AddRowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddRow: (primaryColumnValue: string) => Promise<void>
  primaryColumn: Column | undefined
}

export function AddRowDialog({ open, onOpenChange, onAddRow, primaryColumn }: AddRowDialogProps) {
  const [value, setValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset value when dialog opens/closes
  useEffect(() => {
    if (open) {
      setValue("")
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !isSubmitting) {
      setIsSubmitting(true)
      try {
        await onAddRow(value.trim())
        onOpenChange(false)
      } catch (error) {
        console.error("Failed to add row:", error)
        // Keep dialog open on error so user can retry
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleCancel = () => {
    setValue("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnClickOutside={!isSubmitting}>
      <DialogContent className="sm:min-w-[500px]">
        <DialogClose onClose={handleCancel} />
        <DialogHeader>
          <DialogTitle>Add new row</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="primary-value" className="text-sm font-medium">
              {primaryColumn?.title || "Primary column value"}
            </label>
            <Input
              id="primary-value"
              type={primaryColumn?.type === ColumnTypeEnum.NUMBER ? "number" : "text"}
              placeholder={`Enter ${primaryColumn?.title?.toLowerCase() || "value"}...`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              disabled={isSubmitting}
              className="border-primary focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim() || isSubmitting}>
              {isSubmitting ? "Saving..." : "Add Row"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
