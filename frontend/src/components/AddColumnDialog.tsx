"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ColumnTypeEnum, ColumnTemplate } from "@/lib/types"
import { ColumnTemplates } from "./ColumnTemplates"

interface AddColumnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddColumn: (title: string, type: ColumnTypeEnum, prompt?: string) => Promise<void>
}

export function AddColumnDialog({ open, onOpenChange, onAddColumn }: AddColumnDialogProps) {
  const [columnPrompt, setColumnPrompt] = useState("")
  const [columnTitle, setColumnTitle] = useState("")
  const [columnType, setColumnType] = useState<ColumnTypeEnum>(ColumnTypeEnum.TEXT)
  const [showTemplates, setShowTemplates] = useState(true)
  const [showTitleField, setShowTitleField] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleTemplateSelect = (template: ColumnTemplate) => {
    setColumnPrompt(template.prompt)
    setColumnTitle(template.title)
    setColumnType(template.type)
    setShowTemplates(false)
    setShowTitleField(true)
  }

  const handlePromptChange = (value: string) => {
    setColumnPrompt(value)
    setShowTemplates(false)
    if (value.length > 0) {
      setShowTitleField(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (columnTitle.trim() && columnPrompt.trim() && !isCreating) {
      setIsCreating(true)
      try {
        await onAddColumn(columnTitle.trim(), columnType, columnPrompt.trim())
        setColumnPrompt("")
        setColumnTitle("")
        setColumnType(ColumnTypeEnum.TEXT)
        setShowTemplates(true)
        setShowTitleField(false)
        onOpenChange(false)
      } finally {
        setIsCreating(false)
      }
    }
  }

  const handleClose = () => {
    setColumnPrompt("")
    setColumnTitle("")
    setColumnType(ColumnTypeEnum.TEXT)
    setShowTemplates(true)
    setShowTitleField(false)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnClickOutside={columnPrompt.trim() === "" && columnTitle.trim() === ""}
    >
      <DialogContent className="sm:min-w-[500px] md:min-w-[600px]">
        <DialogClose onClose={handleClose} />
        <DialogHeader>
          <DialogTitle>Add new column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Describe the column you want to create..."
              value={columnPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onFocus={() => setShowTemplates(true)}
              autoFocus
              className="border-primary focus:border-primary focus:ring-primary"
            />
            {showTemplates && columnPrompt === "" && (
              <div className="mt-2 rounded-md border bg-white p-3">
                <ColumnTemplates onSelectTemplate={handleTemplateSelect} />
              </div>
            )}
          </div>
          {showTitleField && (
            <div className="space-y-2">
              <label htmlFor="column-title" className="text-sm font-medium">
                Column title
              </label>
              <Input
                id="column-title"
                placeholder="Enter column title..."
                value={columnTitle}
                onChange={(e) => setColumnTitle(e.target.value)}
                className="border-primary focus:border-primary focus:ring-primary"
              />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="column-type" className="text-sm font-medium">
              Column type
            </label>
            <Select
              id="column-type"
              value={columnType}
              onChange={(e) => setColumnType(e.target.value as ColumnTypeEnum)}
            >
              <option value={ColumnTypeEnum.TEXT}>Text</option>
              <option value={ColumnTypeEnum.NUMBER}>Number</option>
              <option value={ColumnTypeEnum.BOOLEAN}>Boolean</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={!columnTitle.trim() || !columnPrompt.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Column"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
