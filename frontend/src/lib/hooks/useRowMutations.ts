import { useMutation, useQueryClient } from "@tanstack/react-query"
import { rowsAPI } from "@/lib/api"
import { CreateRowRequest } from "@/lib/types"
import { invalidateTableQueries } from "@/lib/query-utils"

export function useCreateRow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, data }: { tableId: number; data: CreateRowRequest }) => rowsAPI.create(tableId, data),
    onSuccess: (_, variables) => {
      // Invalidate rows and columns queries since columns are derived from rows
      invalidateTableQueries(queryClient, variables.tableId)
    },
  })
}

export function useDeleteRow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, rowId }: { tableId: number; rowId: number }) => rowsAPI.delete(tableId, rowId),
    onSuccess: (_, variables) => {
      // Invalidate rows queries
      invalidateTableQueries(queryClient, variables.tableId)
    },
  })
}

export function useRegenerateRow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, rowId }: { tableId: number; rowId: number }) => rowsAPI.regenerate(tableId, rowId),
    onSuccess: (_, variables) => {
      // Invalidate rows queries to reflect regenerated values
      invalidateTableQueries(queryClient, variables.tableId)
    },
  })
}
