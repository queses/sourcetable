"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Sidebar } from "@/components/Sidebar"
import { Button } from "@/components/ui/button"
import { useTables, useCreateTable } from "@/lib/hooks/useTables"
import { useQueryClient } from "@tanstack/react-query"
import { mutationKeys, queryKeys } from "@/lib/queryKeys"

export default function Home() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Fetch tables
  const { data: tables = [], isLoading: loadingTables } = useTables()

  // Create table mutation
  const createTableMutation = useCreateTable()

  // Auto-redirect to first table when available
  useEffect(() => {
    if (tables.length > 0 && !loadingTables) {
      router.replace(`/tables/${tables[0].id}`)
    }
  }, [tables, loadingTables, router])

  const handleCreateTable = async () => {
    try {
      // Wait for any pending create table mutations to complete
      while (queryClient.isMutating({ mutationKey: mutationKeys.tables.create })) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      // Refetch tables query to ensure we have fresh data after any mutations
      // This will wait for any pending refetches to complete
      await queryClient.refetchQueries({ queryKey: queryKeys.tables.all })

      // Get fresh tables from cache
      const freshTables = queryClient.getQueryData(queryKeys.tables.all) ?? []

      const newTable = await createTableMutation.mutateAsync({
        title: `Table ${(freshTables as any[]).length + 1}`,
        columns: {},
      })
      // Navigate to the new table
      router.push(`/tables/${newTable.id}`)
    } catch (error) {
      console.error("Failed to create table:", error)
    }
  }

  if (loadingTables) {
    return (
      <main className="flex h-screen w-screen items-center justify-center overflow-hidden">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    )
  }

  // Show empty state only when no tables exist
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <Sidebar currentTableId={null} />
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="text-muted-foreground">No tables yet</div>
          <Button
            onClick={handleCreateTable}
            disabled={createTableMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {createTableMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create your first table
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  )
}
