"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Table2, Loader2, Pencil, Trash2, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Table } from "@/lib/types"
import { useTables, useCreateTable, useUpdateTable, useDeleteTable } from "@/lib/hooks/useTables"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys, mutationKeys } from "@/lib/queryKeys"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/useAuth"

interface SidebarProps {
  currentTableId: number | null
}

export function Sidebar({ currentTableId }: SidebarProps) {
  const router = useRouter()
  // Fetch tables using TanStack Query
  const { data: tables = [], isLoading: loading } = useTables()
  const queryClient = useQueryClient()
  const { user, logout } = useAuth()

  // Mutations
  const createTableMutation = useCreateTable()
  const updateTableMutation = useUpdateTable()
  const deleteTableMutation = useDeleteTable()

  const [editingTableId, setEditingTableId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>("")
  const [hoveredTableId, setHoveredTableId] = useState<number | null>(null)
  const [deletePopoverOpen, setDeletePopoverOpen] = useState<number | null>(null)
  const [deleteButtonPosition, setDeleteButtonPosition] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const deleteButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const handleCreateTable = async () => {
    try {
      // Check if there are any mutations in flight that might affect tables
      while (queryClient.isMutating({ mutationKey: mutationKeys.tables.create })) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      // Refetch tables query to ensure we have fresh data after any mutations
      // This will wait for any pending refetches to complete
      await queryClient.refetchQueries({ queryKey: queryKeys.tables.all })

      // Get fresh tables from cache
      const freshTables = queryClient.getQueryData<Table[]>(queryKeys.tables.all) ?? []

      const newTable = await createTableMutation.mutateAsync({
        title: `Table ${freshTables.length + 1}`,
        columns: {},
      })
      // Navigate to the new table
      router.push(`/tables/${newTable.id}`)
    } catch (error) {
      console.error("Failed to create table:", error)
    }
  }

  const handleStartRename = (table: Table, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTableId(table.id)
    setEditingTitle(table.title)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const handleCancelRename = () => {
    setEditingTableId(null)
    setEditingTitle("")
  }

  const handleSaveRename = async (tableId: number) => {
    const trimmedTitle = editingTitle.trim()
    if (!trimmedTitle) {
      // Restore old name if empty
      const table = tables.find((t) => t.id === tableId)
      if (table) {
        setEditingTitle(table.title)
      }
      handleCancelRename()
      return
    }

    try {
      await updateTableMutation.mutateAsync({ tableId, data: { title: trimmedTitle } })
      handleCancelRename()
    } catch (error) {
      console.error("Failed to rename table:", error)
      handleCancelRename()
    }
  }

  const handleDeleteClick = (tableId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const button = deleteButtonRefs.current.get(tableId)
    if (button) {
      const rect = button.getBoundingClientRect()
      setDeleteButtonPosition({
        top: rect.top,
        left: rect.right + 8,
      })
    }
    setDeletePopoverOpen(tableId)
  }

  const handleConfirmDelete = async (tableId: number) => {
    try {
      await deleteTableMutation.mutateAsync(tableId)
      if (currentTableId === tableId) {
        // If deleted table was active, navigate to first remaining table or root
        const updatedTables = tables.filter((t) => t.id !== tableId)
        if (updatedTables.length > 0) {
          router.push(`/tables/${updatedTables[0].id}`)
        } else {
          // No tables left, navigate to root
          router.push("/")
        }
      }
      setDeletePopoverOpen(null)
      setDeleteButtonPosition(null)
    } catch (error) {
      console.error("Failed to delete table:", error)
      setDeletePopoverOpen(null)
      setDeleteButtonPosition(null)
    }
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-5 text-2xl">
          <span className="font-bold text-purple-600">Source</span>
          <span className="font-normal text-black">Table</span>
        </div>
        <Button
          onClick={handleCreateTable}
          disabled={createTableMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {createTableMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              New Table
            </>
          )}
        </Button>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No tables yet. Create one to get started!</div>
        ) : (
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tables</div>
            <div className="space-y-1">
              {tables.map((table) => {
                const isActive = currentTableId === table.id
                const isHovered = hoveredTableId === table.id
                const isEditing = editingTableId === table.id
                const showActions = isHovered || isActive

                return (
                  <div
                    key={table.id}
                    className="group relative"
                    onMouseEnter={() => setHoveredTableId(table.id)}
                    onMouseLeave={() => setHoveredTableId(null)}
                  >
                    <div
                      onClick={() => !isEditing && router.push(`/tables/${table.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                          e.preventDefault()
                          router.push(`/tables/${table.id}`)
                        }
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Table2 className="h-4 w-4 flex-shrink-0" />
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveRename(table.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveRename(table.id)
                            } else if (e.key === "Escape") {
                              handleCancelRename()
                            }
                          }}
                          className="flex-1 bg-transparent outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="flex-1 truncate">{table.title}</span>
                          <div
                            className={cn(
                              "relative ml-auto flex flex-shrink-0 items-center gap-1 transition-opacity",
                              showActions ? "opacity-100" : "pointer-events-none opacity-0"
                            )}
                          >
                            <button
                              onClick={(e) => handleStartRename(table, e)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Rename table"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              ref={(el) => {
                                if (el) {
                                  deleteButtonRefs.current.set(table.id, el)
                                } else {
                                  deleteButtonRefs.current.delete(table.id)
                                }
                              }}
                              onClick={(e) => handleDeleteClick(table.id, e)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                              title="Delete table"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            {deletePopoverOpen === table.id && deleteButtonPosition && (
                              <Popover
                                open={true}
                                onOpenChange={(open) => {
                                  if (!open) {
                                    setDeletePopoverOpen(null)
                                    setDeleteButtonPosition(null)
                                  }
                                }}
                              >
                                <PopoverContent
                                  className="w-64 p-4"
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{
                                    position: "fixed",
                                    top: `${deleteButtonPosition.top}px`,
                                    left: `${deleteButtonPosition.left}px`,
                                  }}
                                >
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm font-medium">Delete table?</p>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        This will permanently delete &quot;{table.title}&quot; and all its data. This
                                        action cannot be undone.
                                      </p>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setDeletePopoverOpen(null)
                                          setDeleteButtonPosition(null)
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleConfirmDelete(table.id)}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Auth Section */}
      {user && (
        <div className="border-t p-3">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 truncate">
                <div className="font-medium text-foreground">{user.name || user.email}</div>
                {user.email && user.name && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
              </div>
            </div>
            <Button onClick={logout} variant="outline" size="sm" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
