import { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "./queryKeys"

/**
 * Invalidates both rows and columns queries for a table.
 * This is commonly needed when table data changes since columns are derived from rows.
 */
export function invalidateTableQueries(queryClient: QueryClient, tableId: number): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.rows.all(tableId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.columns.all(tableId) })
}
