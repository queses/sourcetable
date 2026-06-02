import { useQuery } from "@tanstack/react-query"
import { columnsAPI } from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import { Column } from "@/lib/types"

export function useColumns(tableId: number) {
  return useQuery({
    queryKey: queryKeys.columns.all(tableId),
    queryFn: async () => {
      return await columnsAPI.list(tableId)
    },
    enabled: !!tableId,
  })
}
