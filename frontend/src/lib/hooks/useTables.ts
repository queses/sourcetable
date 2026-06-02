import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { tablesAPI } from "@/lib/api"
import { queryKeys, mutationKeys } from "@/lib/queryKeys"
import { Table, CreateTableRequest, UpdateTableRequest } from "@/lib/types"

export function useTables() {
  return useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: () => tablesAPI.list(),
  })
}

export function useCreateTable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.tables.create,
    mutationFn: (data: CreateTableRequest) => tablesAPI.create(data),
    onSuccess: (newTable) => {
      // Invalidate and refetch tables list
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      // Optionally set the new table in cache
      queryClient.setQueryData(queryKeys.tables.detail(newTable.id), newTable)
    },
  })
}

export function useUpdateTable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tableId, data }: { tableId: number; data: UpdateTableRequest }) => tablesAPI.update(tableId, data),
    onSuccess: (updatedTable) => {
      // Invalidate tables list and update the specific table cache
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      queryClient.setQueryData(queryKeys.tables.detail(updatedTable.id), updatedTable)
    },
  })
}

export function useDeleteTable() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (tableId: number) => tablesAPI.delete(tableId),
    onSuccess: (_, tableId) => {
      // Invalidate tables list
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      // Remove the deleted table from cache
      queryClient.removeQueries({ queryKey: queryKeys.tables.detail(tableId) })
      // Also invalidate all related queries (rows, columns)
      queryClient.invalidateQueries({ queryKey: queryKeys.rows.all(tableId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.columns.all(tableId) })
    },
  })
}
