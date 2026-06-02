"use client"

import { Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/DataTable/DataTable"
import { useColumns } from "@/lib/hooks/useColumns"
import { useTables } from "@/lib/hooks/useTables"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queryKeys"

function TablePageContent({ tableId }: { tableId: number }) {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // Fetch columns for the table
  const { data: columns = [], isLoading: loadingColumns } = useColumns(tableId)

  const handleColumnsChange = () => {
    // Invalidate columns query to trigger refetch
    queryClient.invalidateQueries({ queryKey: queryKeys.columns.all(tableId) })
  }

  if (loadingColumns) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading columns...</div>
      </div>
    )
  }

  return <DataTable tableId={tableId} columns={columns} onColumnsChange={handleColumnsChange} />
}

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const tableId = parseInt(id, 10)

  // Fetch tables to validate table exists
  const { data: tables = [], isLoading: loadingTables } = useTables()

  // Validate table ID
  if (isNaN(tableId)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Invalid table ID</div>
      </div>
    )
  }

  if (loadingTables) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Check if table exists
  const tableExists = tables.some((t) => t.id === tableId)
  if (!tableExists) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Table not found</div>
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <TablePageContent tableId={tableId} />
    </Suspense>
  )
}
