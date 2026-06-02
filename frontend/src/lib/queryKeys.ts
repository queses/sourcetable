export const queryKeys = {
  tables: {
    all: ["tables"] as const,
    detail: (id: number) => ["tables", id] as const,
  },
  rows: {
    all: (tableId: number) => ["tables", tableId, "rows"] as const,
    detail: (tableId: number, rowId: number) => ["tables", tableId, "rows", rowId] as const,
    list: (
      tableId: number,
      params?: { sort_by_column_id?: number; sort_asc?: boolean; page_size?: number; cursor?: string; filters?: any[] }
    ) => {
      const key: (string | number | boolean | undefined | any)[] = ["tables", tableId, "rows", "list"]
      if (params?.sort_by_column_id !== undefined) key.push("sort", params.sort_by_column_id, params.sort_asc ?? true)
      if (params?.page_size !== undefined) key.push("page_size", params.page_size)
      if (params?.cursor) key.push("cursor", params.cursor)
      if (params?.filters && params.filters.length > 0) {
        key.push("filters", JSON.stringify(params.filters))
      }
      return key
    },
  },
  columns: {
    all: (tableId: number) => ["tables", tableId, "columns"] as const,
  },
}

export const mutationKeys = {
  tables: {
    create: ["tables", "create"] as const,
  },
}
