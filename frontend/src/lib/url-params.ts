import { ReadonlyURLSearchParams } from "next/navigation"
import { ColumnFilter } from "@/lib/types"
import { SortingState } from "@tanstack/react-table"

export interface TableViewParams {
  sort?: { column_id: number; order: "asc" | "desc" } | null
  filters?: ColumnFilter[]
  cursor?: string | null
  search?: string | null
}

/**
 * Parse sort parameter from URL search params
 */
export function parseSortParam(
  searchParams: ReadonlyURLSearchParams
): { column_id: number; order: "asc" | "desc" } | null {
  const sortParam = searchParams.get("sort")
  if (!sortParam) return null

  try {
    const parsed = JSON.parse(sortParam)
    if (typeof parsed.column_id === "number" && (parsed.order === "asc" || parsed.order === "desc")) {
      return { column_id: parsed.column_id, order: parsed.order }
    }
  } catch (e) {
    // Invalid JSON, return null
  }
  return null
}

/**
 * Convert sort param to React Table sorting state
 */
export function sortParamToSortingState(sortParam: { column_id: number; order: "asc" | "desc" } | null): SortingState {
  if (!sortParam) return []
  return [{ id: `col-${sortParam.column_id}`, desc: sortParam.order === "desc" }]
}

/**
 * Convert React Table sorting state to sort param
 */
export function sortingStateToSortParam(sorting: SortingState): { column_id: number; order: "asc" | "desc" } | null {
  if (sorting.length === 0) return null
  const sort = sorting[0]
  const columnIdMatch = sort.id.match(/^col-(\d+)$/)
  if (!columnIdMatch) return null
  const columnId = parseInt(columnIdMatch[1], 10)
  return {
    column_id: columnId,
    order: sort.desc ? "desc" : "asc",
  }
}

/**
 * Parse filters parameter from URL search params
 */
export function parseFiltersParam(searchParams: ReadonlyURLSearchParams): ColumnFilter[] {
  const filtersParam = searchParams.get("filters")
  if (!filtersParam) return []

  try {
    const parsed = JSON.parse(filtersParam)
    if (Array.isArray(parsed)) {
      // Validate that each item is a valid ColumnFilter
      return parsed.filter((filter) => typeof filter.column_id === "number")
    }
  } catch (e) {
    // Invalid JSON, return empty array
  }
  return []
}

/**
 * Convert filters array to Map for DataTable state
 */
export function filtersArrayToMap(filters: ColumnFilter[]): Map<number, ColumnFilter> {
  const map = new Map<number, ColumnFilter>()
  filters.forEach((filter) => {
    map.set(filter.column_id, filter)
  })
  return map
}

/**
 * Build query string from table view parameters
 */
export function buildQueryString(params: TableViewParams): string {
  const searchParams = new URLSearchParams()

  if (params.sort) {
    searchParams.set("sort", JSON.stringify(params.sort))
  }

  if (params.filters && params.filters.length > 0) {
    searchParams.set("filters", JSON.stringify(params.filters))
  }

  if (params.cursor) {
    searchParams.set("cursor", params.cursor)
  }

  if (params.search) {
    searchParams.set("search", params.search)
  }

  return searchParams.toString()
}

/**
 * Update URL with new table view parameters
 */
export function updateTableViewUrl(
  tableId: number,
  params: Partial<TableViewParams>,
  currentSearchParams: ReadonlyURLSearchParams
): string {
  // Get current params
  const currentSort = parseSortParam(currentSearchParams)
  const currentFilters = parseFiltersParam(currentSearchParams)
  const currentCursor = currentSearchParams.get("cursor") || null
  const currentSearch = currentSearchParams.get("search") || null

  // Merge with new params
  const newParams: TableViewParams = {
    sort: params.sort !== undefined ? params.sort : currentSort,
    filters: params.filters !== undefined ? params.filters : currentFilters,
    cursor: params.cursor !== undefined ? params.cursor : currentCursor,
    search: params.search !== undefined ? params.search : currentSearch,
  }

  const queryString = buildQueryString(newParams)
  return `/tables/${tableId}${queryString ? `?${queryString}` : ""}`
}
