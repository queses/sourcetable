import { useQuery, UseQueryOptions } from "@tanstack/react-query"
import { rowsAPI } from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import { GetRowsQueryParams, RowWithCells, RowsListResponse } from "@/lib/types"

export interface UseRowsResult {
  rows: RowWithCells[]
  nextCursor: string | null
  previousCursor: string | null
  isLoading: boolean
  error: Error | null
}

export function useRows(
  tableId: number,
  params?: GetRowsQueryParams,
  options?: Omit<UseQueryOptions<RowsListResponse, Error>, "queryKey" | "queryFn">
): UseRowsResult {
  const query = useQuery({
    queryKey: queryKeys.rows.list(tableId, params),
    queryFn: () => rowsAPI.list(tableId, params),
    enabled: !!tableId,
    ...options,
  })

  return {
    rows: query.data?.rows || [],
    nextCursor: query.data?.next_cursor || null,
    previousCursor: query.data?.previous_cursor || null,
    isLoading: query.isLoading,
    error: query.error,
  }
}
