"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column as TableColumn,
} from "@tanstack/react-table"
import {
  Plus,
  Link2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { RowWithCells, Column, ColumnTypeEnum, RowsListResponse } from "@/lib/types"
import { AddColumnDialog } from "../AddColumnDialog"
import { AddRowDialog } from "../AddRowDialog"
import { uploadAPI } from "@/lib/api"
import { useRows } from "@/lib/hooks/useRows"
import { useCreateColumn, useDeleteColumn, useRegenerateColumn } from "@/lib/hooks/useColumnMutations"
import { useCreateRow, useDeleteRow, useRegenerateRow } from "@/lib/hooks/useRowMutations"
import { useUpdateCell } from "@/lib/hooks/useCellMutations"
import { useQueryClient } from "@tanstack/react-query"
import { hasActiveAgents } from "@/lib/utils"
import { invalidateTableQueries } from "@/lib/query-utils"
import { DataCell } from "./DataCell"
import { TableToolbar } from "./TableToolbar"
import { ColumnFilterPopover } from "./ColumnFilterPopover"
import { ColumnMenu, DeleteColumnConfirmDialog } from "./ColumnMenu"
import { RowMenu, DeleteRowConfirmDialog } from "./RowMenu"
import { ColumnFilter } from "@/lib/types"
import {
  parseSortParam,
  parseFiltersParam,
  sortParamToSortingState,
  sortingStateToSortParam,
  filtersArrayToMap,
  updateTableViewUrl,
} from "@/lib/url-params"

interface DataTableProps {
  tableId: number
  columns: Column[]
  onColumnsChange: () => void
}

export function DataTable({ tableId, columns, onColumnsChange }: DataTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // Initialize state from URL params
  const initialSort = useMemo(() => {
    const sortParam = parseSortParam(searchParams)
    return sortParam ? sortParamToSortingState(sortParam) : []
  }, [searchParams]) // Only on mount

  const initialFilters = useMemo(() => {
    const filtersArray = parseFiltersParam(searchParams)
    return filtersArrayToMap(filtersArray)
  }, [searchParams]) // Only on mount

  const initialCursor = useMemo(() => {
    return searchParams.get("cursor") || null
  }, [searchParams]) // Only on mount

  const initialSearch = useMemo(() => {
    return searchParams.get("search") || ""
  }, [searchParams]) // Only on mount

  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false)
  const [isAddRowOpen, setIsAddRowOpen] = useState(false)
  const [isUploadingCsv, setIsUploadingCsv] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [sorting, setSorting] = useState<SortingState>(initialSort)
  const [filters, setFilters] = useState<Map<number, ColumnFilter>>(initialFilters)
  const [openFilterColumnId, setOpenFilterColumnId] = useState<number | null>(null)
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null)

  // Column menu state
  const [columnMenuOpen, setColumnMenuOpen] = useState<number | null>(null)
  const [deleteColumnConfirmOpen, setDeleteColumnConfirmOpen] = useState<number | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  // Row menu state
  const [rowMenuOpen, setRowMenuOpen] = useState<number | null>(null)
  const [deleteRowConfirmOpen, setDeleteRowConfirmOpen] = useState<number | null>(null)
  const [rowMenuPosition, setRowMenuPosition] = useState<{ top: number; left: number } | null>(null)

  // Pagination state
  const [currentCursor, setCurrentCursor] = useState<string | null>(initialCursor)
  // Track cursor history for backward navigation (stores the cursor that was used to get to each page)
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([])

  // Convert React Table sorting state to backend format
  const backendSortParams = useMemo(() => {
    if (sorting.length === 0) {
      return { sort_by_column_id: undefined, sort_asc: true }
    }
    const sort = sorting[0] // React Table supports multi-sort, but we'll use first one
    // Extract column ID from "col-{id}" format
    const columnIdMatch = sort.id.match(/^col-(\d+)$/)
    if (!columnIdMatch) {
      return { sort_by_column_id: undefined, sort_asc: true }
    }
    const columnId = parseInt(columnIdMatch[1], 10)
    return {
      sort_by_column_id: columnId,
      sort_asc: !sort.desc, // React Table uses desc: true for descending, backend uses sort_asc
    }
  }, [sorting])

  // Convert filters map to array for API
  const filtersArray = useMemo(() => {
    return Array.from(filters.values())
  }, [filters])

  // Helper function to update URL with current state
  const updateUrl = useCallback(
    (updates: {
      sort?: { column_id: number; order: "asc" | "desc" } | null
      filters?: ColumnFilter[]
      cursor?: string | null
      search?: string | null
    }) => {
      const newUrl = updateTableViewUrl(tableId, updates, searchParams)
      router.push(newUrl)
    },
    [tableId, searchParams, router]
  )

  // Handle search query change and update URL
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      // Update URL with new search query
      updateUrl({ search: value || null })
    },
    [updateUrl]
  )

  // Fetch rows with TanStack Query
  const {
    rows,
    nextCursor,
    previousCursor,
    isLoading: loading,
  } = useRows(
    tableId,
    {
      page_size: 20,
      cursor: currentCursor || undefined,
      sort_by_column_id: backendSortParams.sort_by_column_id,
      sort_asc: backendSortParams.sort_asc,
      filters: filtersArray.length > 0 ? filtersArray : undefined,
    },
    {
      refetchInterval: (query) => {
        // Check if any rows have active agents
        const responseData = query.state.data as RowsListResponse | undefined
        const rowsData = responseData?.rows
        if (rowsData && rowsData.some(hasActiveAgents)) {
          return 2000 // Poll every 2 seconds if active agents
        }
        return false // Stop polling if no active agents
      },
    }
  )

  // Sync state from URL params when they change (e.g., browser back/forward, direct navigation)
  useEffect(() => {
    const urlCursor = searchParams.get("cursor") || null
    const urlSearch = searchParams.get("search") || ""
    const urlSortParam = parseSortParam(searchParams)
    const urlSorting = urlSortParam ? sortParamToSortingState(urlSortParam) : []
    const urlFiltersArray = parseFiltersParam(searchParams)
    const urlFilters = filtersArrayToMap(urlFiltersArray)

    // Sync cursor from URL
    if (urlCursor !== currentCursor) {
      setCurrentCursor(urlCursor)
      // Clear cursor history when syncing from URL (we don't track browser history)
      setCursorHistory([])
    }

    // Sync search from URL
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch)
    }

    // Sync sorting from URL
    const currentSortString = JSON.stringify(sorting)
    const urlSortString = JSON.stringify(urlSorting)
    if (urlSortString !== currentSortString) {
      setSorting(urlSorting)
    }

    // Sync filters from URL
    const currentFiltersString = JSON.stringify(Array.from(filters.entries()).sort((a, b) => a[0] - b[0]))
    const urlFiltersString = JSON.stringify(Array.from(urlFilters.entries()).sort((a, b) => a[0] - b[0]))
    if (urlFiltersString !== currentFiltersString) {
      setFilters(urlFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Reset pagination when filters, sorting, or table changes
  useEffect(() => {
    // Reset cursor to null when filters/sorting/table changes
    // Only update if cursor is not already null to avoid unnecessary URL updates
    setCurrentCursor((prev) => {
      if (prev !== null) {
        setCursorHistory([])
        // Update URL to remove cursor when filters/sorting change
        // Include current sort and filters to ensure URL reflects latest state
        const sortParam = sortingStateToSortParam(sorting)
        updateUrl({ cursor: null, sort: sortParam, filters: filtersArray.length > 0 ? filtersArray : [] })
        return null
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, backendSortParams.sort_by_column_id, backendSortParams.sort_asc, filtersArray])

  // Navigate to next page
  const handleNextPage = useCallback(() => {
    if (!nextCursor || loading) return
    // Add current cursor to history before moving forward (including null for first page)
    setCursorHistory((prev) => [...prev, currentCursor])
    setCurrentCursor(nextCursor)
    // Update URL with new cursor
    updateUrl({ cursor: nextCursor })
  }, [nextCursor, loading, currentCursor, updateUrl])

  // Navigate to previous page
  const handlePreviousPage = useCallback(() => {
    if (loading) return
    // Pop the last cursor from history, or use null if history is empty
    let newCursor: string | null = null
    if (cursorHistory.length > 0) {
      const newHistory = [...cursorHistory]
      newCursor = newHistory.pop() || null
      setCursorHistory(newHistory)
    }
    setCurrentCursor(newCursor)
    // Update URL with new cursor
    updateUrl({ cursor: newCursor })
  }, [cursorHistory, loading, updateUrl])

  // Check if we're on the first page
  const isFirstPage = currentCursor === null && cursorHistory.length === 0

  // Mutations
  const createColumnMutation = useCreateColumn()
  const deleteColumnMutation = useDeleteColumn()
  const regenerateColumnMutation = useRegenerateColumn()
  const createRowMutation = useCreateRow()
  const deleteRowMutation = useDeleteRow()
  const regenerateRowMutation = useRegenerateRow()
  const updateCellMutation = useUpdateCell()

  const handleColumnMenuClick = (columnId: number, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    const button = event.currentTarget as HTMLButtonElement
    const rect = button.getBoundingClientRect()
    setMenuPosition({
      top: rect.top,
      left: rect.left - 160, // Open on the left side of the button
    })
    setColumnMenuOpen(columnId)
  }

  const handleDeleteColumnClick = (columnId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    const button = event.currentTarget as HTMLButtonElement
    const rect = button.getBoundingClientRect()
    setMenuPosition({
      top: rect.top,
      left: rect.left - 100, // Open on the left side of the button
    })
    setDeleteColumnConfirmOpen(columnId)
    setColumnMenuOpen(null)
  }

  const handleRegenerateColumnClick = async (columnId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await regenerateColumnMutation.mutateAsync({ tableId, columnId })
    } catch (error) {
      console.error("Failed to regenerate column:", error)
    }
    setColumnMenuOpen(null)
  }

  const handleConfirmDeleteColumn = async (columnId: number) => {
    try {
      await deleteColumnMutation.mutateAsync({ tableId, columnId })
      setDeleteColumnConfirmOpen(null)
      setMenuPosition(null)
      onColumnsChange()
    } catch (error) {
      console.error("Failed to delete column:", error)
      setDeleteColumnConfirmOpen(null)
      setMenuPosition(null)
    }
  }

  const handleRowMenuClick = (rowId: number, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    const button = event.currentTarget as HTMLButtonElement
    const rect = button.getBoundingClientRect()
    setRowMenuPosition({
      top: rect.top,
      left: rect.left + 28, // Open on the right side of the button
    })
    setRowMenuOpen(rowId)
  }

  const handleDeleteRowClick = (rowId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    const button = event.currentTarget as HTMLButtonElement
    const rect = button.getBoundingClientRect()
    setRowMenuPosition({
      top: rect.top - 48,
      left: rect.left, // Open on the right side of the button
    })
    setDeleteRowConfirmOpen(rowId)
    setRowMenuOpen(null)
  }

  const handleRegenerateRowClick = async (rowId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await regenerateRowMutation.mutateAsync({ tableId, rowId })
    } catch (error) {
      console.error("Failed to regenerate row:", error)
    }
    setRowMenuOpen(null)
  }

  const handleConfirmDeleteRow = async (rowId: number) => {
    try {
      await deleteRowMutation.mutateAsync({ tableId, rowId })
      setDeleteRowConfirmOpen(null)
      setRowMenuPosition(null)
    } catch (error) {
      console.error("Failed to delete row:", error)
      setDeleteRowConfirmOpen(null)
      setRowMenuPosition(null)
    }
  }

  const handleAddColumn = async (title: string, type: ColumnTypeEnum, prompt?: string) => {
    try {
      await createColumnMutation.mutateAsync({
        tableId,
        data: {
          table_id: tableId,
          title,
          type,
          prompt: prompt || null,
        },
      })
      onColumnsChange()
    } catch (error) {
      console.error("Failed to add column:", error)
    }
  }

  const handleAddRow = async (primaryColumnValue: string) => {
    try {
      // Create the row with the primary column value
      await createRowMutation.mutateAsync({
        tableId,
        data: { table_id: tableId, primary_value: primaryColumnValue },
      })
    } catch (error) {
      console.error("Failed to add row:", error)
      throw error // Re-throw so the dialog can handle it
    }
  }

  const handleCellChange = async (rowId: number, columnId: number, value: string) => {
    // Find the cell to update
    const row = rows.find((r) => r.id === rowId)
    const cell = row?.cells.find((c) => c.column_id === columnId)

    if (!cell) return

    // Only allow updating primary column values
    const column = columns.find((c) => c.id === columnId)
    if (!column?.is_primary) {
      return // Other columns are not editable
    }

    try {
      await updateCellMutation.mutateAsync({
        tableId,
        rowId,
        cellId: cell.id,
        value,
      })
    } catch (error) {
      console.error("Failed to update cell:", error)
    }
  }

  const handleSelectRow = useCallback(
    (rowId: number, checked: boolean) => {
      const newSelected = new Set(selectedRows)
      if (checked) {
        newSelected.add(rowId)
      } else {
        newSelected.delete(rowId)
      }
      setSelectedRows(newSelected)
    },
    [selectedRows]
  )

  const handleApplyFilter = (columnId: number, filter: ColumnFilter | null) => {
    const newFilters = new Map(filters)
    if (filter) {
      newFilters.set(columnId, filter)
    } else {
      newFilters.delete(columnId)
    }
    setFilters(newFilters)
    // Update URL with new filters
    const filtersArray = Array.from(newFilters.values())
    updateUrl({ filters: filtersArray.length > 0 ? filtersArray : [] })
  }

  const handleFilterClick = (columnId: number, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation() // Prevent sort toggle
    setFilterAnchorEl(event.currentTarget)
    setOpenFilterColumnId(columnId)
  }

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows
    return rows.filter((row) => row.cells.some((cell) => cell.value?.toLowerCase().includes(searchQuery.toLowerCase())))
  }, [rows, searchQuery])

  // Get primary column
  const primaryColumn = columns.find((col) => col.is_primary) || columns[0]
  const otherColumns = columns.filter((col) => !col.is_primary)

  const tableColumns = useMemo<ColumnDef<RowWithCells>[]>(() => {
    const cols: ColumnDef<RowWithCells>[] = [
      {
        id: "select",
        cell: ({ row, table }) => {
          return (
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => handleRowMenuClick(row.original.id, e)}
                className="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Row options"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          )
        },
        maxSize: 24,
      },
    ]

    // Add primary column
    if (primaryColumn) {
      cols.push({
        id: `col-${primaryColumn.id}`,
        enableSorting: true,
        accessorFn: (row) => {
          const cell = row.cells.find((c) => c.column_id === primaryColumn.id)
          return cell?.value || ""
        },
        header: ({ column }) => (
          <SortableHeader
            column={column}
            columnData={primaryColumn}
            hasFilter={filters.has(primaryColumn.id)}
            onFilterClick={(e) => handleFilterClick(primaryColumn.id, e)}
            onMenuClick={(columnId: number, e: React.MouseEvent<HTMLElement>) => handleColumnMenuClick(columnId, e)}
          >
            <span>{primaryColumn.title}</span>
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const cell = row.original.cells.find((c) => c.column_id === primaryColumn.id)
          return <DataCell value={cell?.value || ""} type={primaryColumn.type} agentState={cell?.agent_state} />
        },
      })
    }

    // Add other columns
    otherColumns.forEach((col) => {
      cols.push({
        id: `col-${col.id}`,
        enableSorting: true,
        accessorFn: (row) => {
          const cell = row.cells.find((c) => c.column_id === col.id)
          return cell?.value || ""
        },
        header: ({ column }) => (
          <SortableHeader
            column={column}
            columnData={col}
            hasFilter={filters.has(col.id)}
            onFilterClick={(e) => handleFilterClick(col.id, e)}
            onMenuClick={(columnId: number, e: React.MouseEvent<HTMLElement>) => handleColumnMenuClick(columnId, e)}
          >
            {col.title ? <span>{col.title}</span> : <span className="text-primary">New column</span>}
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const cell = row.original.cells.find((c) => c.column_id === col.id)
          const agentState = cell?.agent_state
          return <DataCell value={cell?.value || ""} type={col.type} agentState={agentState} />
        },
      })
    })

    return cols
  }, [primaryColumn, otherColumns, selectedRows, filters, handleSelectRow])

  // Handle sorting change and update URL
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater
      setSorting(newSorting)
      // Update URL with new sort
      const sortParam = sortingStateToSortParam(newSorting)
      updateUrl({ sort: sortParam })
    },
    [sorting, updateUrl]
  )

  const table = useReactTable({
    data: filteredRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Sorting is handled server-side
    onSortingChange: handleSortingChange,
    state: {
      sorting,
    },
  })

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingCsv(true)
    try {
      await uploadAPI.uploadCsv(tableId, file)
      // Invalidate queries to refetch data
      invalidateTableQueries(queryClient, tableId)
      onColumnsChange()
    } catch (error) {
      console.error("Failed to upload CSV:", error)
    } finally {
      setIsUploadingCsv(false)
      // Reset the file input so the same file can be uploaded again
      event.target.value = ""
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        columns={columns}
        onAddColumn={() => setIsAddColumnOpen(true)}
        onCsvUpload={handleCsvUpload}
        isUploadingCsv={isUploadingCsv}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-12 border-b px-4 text-left align-middle font-medium text-muted-foreground"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length} className="h-24 text-center text-muted-foreground">
                    No rows found. Try uploading a CSV file or add a row manually.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-b transition-colors hover:bg-muted/50 ${
                      selectedRows.has(row.original.id) ? "bg-purple-50" : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-0">
                        <div className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with Add Row button and Pagination */}
      <div className="flex items-center justify-between border-t bg-white px-6 py-4">
        <Button onClick={() => setIsAddRowOpen(true)} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Row
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={handlePreviousPage} variant="outline" disabled={isFirstPage || loading} size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button onClick={handleNextPage} variant="outline" disabled={!nextCursor || loading} size="sm">
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <AddColumnDialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen} onAddColumn={handleAddColumn} />
      <AddRowDialog
        open={isAddRowOpen}
        onOpenChange={setIsAddRowOpen}
        onAddRow={handleAddRow}
        primaryColumn={primaryColumn}
      />

      {/* Filter Popovers */}
      {openFilterColumnId !== null &&
        (() => {
          const column = columns.find((c) => c.id === openFilterColumnId)
          if (!column) return null
          return (
            <ColumnFilterPopover
              open={openFilterColumnId !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setOpenFilterColumnId(null)
                  setFilterAnchorEl(null)
                }
              }}
              column={column}
              filter={filters.get(openFilterColumnId) || null}
              onApplyFilter={(filter) => handleApplyFilter(openFilterColumnId, filter)}
              anchorEl={filterAnchorEl}
            />
          )
        })()}

      {/* Column Menu Popover */}
      {columnMenuOpen !== null &&
        (() => {
          const column = columns.find((c) => c.id === columnMenuOpen)
          if (!column) return null
          return (
            <ColumnMenu
              column={column}
              isOpen={columnMenuOpen !== null}
              position={menuPosition}
              onClose={() => setColumnMenuOpen(null)}
              onDeleteClick={handleDeleteColumnClick}
              onRegenerateClick={handleRegenerateColumnClick}
            />
          )
        })()}

      {/* Delete Column Confirmation Popover */}
      {deleteColumnConfirmOpen !== null &&
        (() => {
          const column = columns.find((c) => c.id === deleteColumnConfirmOpen)
          if (!column) return null
          return (
            <DeleteColumnConfirmDialog
              column={column}
              isOpen={deleteColumnConfirmOpen !== null}
              position={menuPosition}
              onClose={() => {
                setDeleteColumnConfirmOpen(null)
                setMenuPosition(null)
              }}
              onConfirm={handleConfirmDeleteColumn}
            />
          )
        })()}

      {/* Row Menu Popover */}
      {rowMenuOpen !== null &&
        (() => {
          const row = rows.find((r) => r.id === rowMenuOpen)
          if (!row) return null
          return (
            <RowMenu
              row={row}
              isOpen={rowMenuOpen !== null}
              position={rowMenuPosition}
              onClose={() => setRowMenuOpen(null)}
              onDeleteClick={handleDeleteRowClick}
              onRegenerateClick={handleRegenerateRowClick}
            />
          )
        })()}

      {/* Delete Row Confirmation Popover */}
      {deleteRowConfirmOpen !== null &&
        (() => {
          const row = rows.find((r) => r.id === deleteRowConfirmOpen)
          if (!row) return null
          return (
            <DeleteRowConfirmDialog
              row={row}
              isOpen={deleteRowConfirmOpen !== null}
              position={rowMenuPosition}
              onClose={() => {
                setDeleteRowConfirmOpen(null)
                setRowMenuPosition(null)
              }}
              onConfirm={handleConfirmDeleteRow}
            />
          )
        })()}
    </div>
  )
}

// Sort indicator component
function SortIndicator({ sortState }: { sortState: false | "asc" | "desc" }) {
  if (sortState === "asc") {
    return <ArrowUp className="h-4 w-4" />
  }
  if (sortState === "desc") {
    return <ArrowDown className="h-4 w-4" />
  }
  return <ArrowUpDown className="h-4 w-4 opacity-50" />
}

// Sortable header wrapper component
function SortableHeader({
  column,
  columnData,
  hasFilter,
  onFilterClick,
  onMenuClick,
  children,
}: {
  column: TableColumn<RowWithCells, unknown>
  columnData: Column
  hasFilter: boolean
  onFilterClick: (e: React.MouseEvent<HTMLElement>) => void
  onMenuClick: (columnId: number, e: React.MouseEvent<HTMLElement>) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div
        className="flex cursor-pointer select-none items-center gap-2 hover:text-foreground"
        onClick={column.getToggleSortingHandler()}
      >
        {children}
        <SortIndicator sortState={column.getIsSorted()} />
        <button
          onClick={onFilterClick}
          className={`flex items-center justify-center rounded p-1 hover:bg-muted ${
            hasFilter ? "text-primary" : "text-muted-foreground"
          }`}
          title="Filter column"
        >
          <Filter className={`h-4 w-4 ${hasFilter ? "" : "opacity-50"}`} />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => onMenuClick(columnData.id, e)}
          className="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
