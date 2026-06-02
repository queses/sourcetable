"use client"

import { useState, useEffect, useMemo } from "react"
import { X } from "lucide-react"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Column, ColumnTypeEnum, ColumnFilter } from "@/lib/types"
import { calculatePopoverPosition } from "@/lib/utils"

interface ColumnFilterPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  column: Column
  filter: ColumnFilter | null
  onApplyFilter: (filter: ColumnFilter | null) => void
  anchorEl?: HTMLElement | null
}

export function ColumnFilterPopover({
  open,
  onOpenChange,
  column,
  filter,
  onApplyFilter,
  anchorEl,
}: ColumnFilterPopoverProps) {
  // Local state for filter values
  const [textValue, setTextValue] = useState("")
  const [minValue, setMinValue] = useState<string>("")
  const [maxValue, setMaxValue] = useState<string>("")
  const [booleanValue, setBooleanValue] = useState<number | null>(null)

  // Initialize local state from filter prop
  useEffect(() => {
    if (filter) {
      if (column.type === ColumnTypeEnum.TEXT) {
        setTextValue(filter.value || "")
      } else if (column.type === ColumnTypeEnum.NUMBER) {
        setMinValue(filter.min_value?.toString() || "")
        setMaxValue(filter.max_value?.toString() || "")
      } else if (column.type === ColumnTypeEnum.BOOLEAN) {
        // Convert boolean to 1/0, or null if not set
        setBooleanValue(filter.boolean_value === true ? 1 : filter.boolean_value === false ? 0 : null)
      }
    } else {
      // Reset to empty state
      setTextValue("")
      setMinValue("")
      setMaxValue("")
      setBooleanValue(null)
    }
  }, [filter, column.type])

  const handleApply = () => {
    let newFilter: ColumnFilter | null = null

    if (column.type === ColumnTypeEnum.TEXT) {
      if (textValue.trim()) {
        newFilter = {
          column_id: column.id,
          value: textValue.trim(),
        }
      }
    } else if (column.type === ColumnTypeEnum.NUMBER) {
      const min = minValue.trim() ? parseFloat(minValue) : null
      const max = maxValue.trim() ? parseFloat(maxValue) : null
      if (min !== null || max !== null) {
        newFilter = {
          column_id: column.id,
          min_value: min ?? undefined,
          max_value: max ?? undefined,
        }
      }
    } else if (column.type === ColumnTypeEnum.BOOLEAN) {
      if (booleanValue !== null) {
        // Convert 1/0 to boolean for the API
        newFilter = {
          column_id: column.id,
          boolean_value: booleanValue === 1,
        }
      }
    }

    onApplyFilter(newFilter)
    onOpenChange(false)
  }

  const handleClear = () => {
    setTextValue("")
    setMinValue("")
    setMaxValue("")
    setBooleanValue(null)
    onApplyFilter(null)
    onOpenChange(false)
  }

  const hasActiveFilter = filter !== null

  const popoverState = useMemo(() => {
    return calculatePopoverPosition(anchorEl, 320, 16)
  }, [anchorEl])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent style={popoverState} className="w-80 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Filter: {column.title || "Column"}</h3>
            <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {column.type === ColumnTypeEnum.TEXT && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Search text</label>
              <Input
                type="text"
                placeholder="Enter search term..."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleApply()
                  }
                }}
              />
            </div>
          )}

          {column.type === ColumnTypeEnum.NUMBER && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Range</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  className="flex-1"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="To"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {column.type === ColumnTypeEnum.BOOLEAN && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Value</label>
              <Select
                value={booleanValue === null ? "" : booleanValue === 1 ? "1" : "0"}
                onChange={(e) => {
                  const val = e.target.value
                  setBooleanValue(val === "" ? null : val === "1" ? 1 : 0)
                }}
              >
                <option value="">Any</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {hasActiveFilter && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                Clear
              </Button>
            )}
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
