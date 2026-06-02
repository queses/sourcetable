import { useMutation, useQueryClient } from "@tanstack/react-query"
import { cellsAPI } from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"

export function useUpdateCell() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      tableId,
      rowId,
      cellId,
      value,
    }: {
      tableId: number
      rowId: number
      cellId: number
      value: string
    }) => cellsAPI.update(tableId, rowId, cellId, value),
    onSuccess: (updatedCell, variables) => {
      // Invalidate rows list to get updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.rows.all(variables.tableId) })
      // Also update the specific row cache if it exists
      queryClient.invalidateQueries({ queryKey: queryKeys.rows.detail(variables.tableId, variables.rowId) })
    },
  })
}
