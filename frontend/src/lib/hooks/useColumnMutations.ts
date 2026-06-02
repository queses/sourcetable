import { useMutation, useQueryClient } from "@tanstack/react-query"
import { columnsAPI } from "@/lib/api"
import { CreateColumnRequest } from "@/lib/types"
import { invalidateTableQueries } from "@/lib/query-utils"

export function useCreateColumn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, data }: { tableId: number; data: CreateColumnRequest }) => columnsAPI.create(tableId, data),
    onSuccess: (_, variables) => {
      // Invalidate rows and columns queries since columns are derived from rows
      invalidateTableQueries(queryClient, variables.tableId)
    },
  })
}

export function useDeleteColumn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, columnId }: { tableId: number; columnId: number }) => columnsAPI.delete(tableId, columnId),
    onSuccess: (_, variables) => {
      // Invalidate rows and columns queries
      invalidateTableQueries(queryClient, variables.tableId)
    },
  })
}

export function useRegenerateColumn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, columnId }: { tableId: number; columnId: number }) =>
      columnsAPI.regenerate(tableId, columnId),
    onSuccess: (_, variables) => {
      // Invalidate rows queries to reflect regenerated values
      invalidateTableQueries(queryClient, variables.tableId)
    },
  })
}
