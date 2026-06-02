"use client"

import { Plus, Search, Columns3, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Column } from "@/lib/types"

interface TableToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  columns: Column[]
  onAddColumn: () => void
  onCsvUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  isUploadingCsv?: boolean
}

export function TableToolbar({
  searchQuery,
  onSearchChange,
  columns,
  onAddColumn,
  onCsvUpload,
  isUploadingCsv = false,
}: TableToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-white px-6 py-4">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <input
            type="file"
            accept=".csv"
            onChange={onCsvUpload}
            className="hidden"
            id="csv-upload"
            disabled={isUploadingCsv}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("csv-upload")?.click()}
            disabled={isUploadingCsv}
          >
            {isUploadingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload CSV
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Columns3 className="h-4 w-4" />
          <span>{columns.length} columns</span>
        </div>
      </div>
      <Button onClick={onAddColumn} className="bg-primary hover:bg-primary/90">
        <Plus className="mr-2 h-4 w-4" />
        Add new column
      </Button>
    </div>
  )
}
