import {
  Table,
  Column,
  RowWithCells,
  CreateTableRequest,
  UpdateTableRequest,
  CreateColumnRequest,
  CreateRowRequest,
  GetRowsQueryParams,
  UploadCsvResponse,
  CellWithColumn,
  RowsListResponse,
} from "./types"
import { getToken } from "./auth-storage"
import { clearTokens } from "./auth-storage"
import { authAPI } from "./api/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  // Get JWT token from localStorage (SSR-safe)
  const token = getToken()

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  }

  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }))
    if (response.status === 401 && error?.detail === "Token has expired") {
      clearTokens()
      authAPI.login()
      return
    }

    throw new Error(error?.detail || "Unknown error")
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Tables API
export const tablesAPI = {
  list: async (): Promise<Table[]> => {
    return fetchAPI<Table[]>("/api/tables/")
  },

  create: async (data: CreateTableRequest): Promise<Table> => {
    return fetchAPI<Table>("/api/tables/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: async (tableId: number, data: UpdateTableRequest): Promise<Table> => {
    return fetchAPI<Table>(`/api/tables/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  delete: async (tableId: number): Promise<void> => {
    return fetchAPI<void>(`/api/tables/${tableId}`, {
      method: "DELETE",
    })
  },
}

// Columns API
export const columnsAPI = {
  list: async (tableId: number): Promise<Column[]> => {
    return fetchAPI<Column[]>(`/api/tables/${tableId}/columns`)
  },

  create: async (tableId: number, data: CreateColumnRequest): Promise<Column> => {
    return fetchAPI<Column>(`/api/tables/${tableId}/columns`, {
      method: "POST",
      body: JSON.stringify({ ...data, table_id: tableId }),
    })
  },

  delete: async (tableId: number, columnId: number): Promise<void> => {
    return fetchAPI<void>(`/api/tables/${tableId}/columns/${columnId}`, {
      method: "DELETE",
    })
  },

  regenerate: async (tableId: number, columnId: number): Promise<void> => {
    return fetchAPI<void>(`/api/tables/${tableId}/columns/${columnId}/regenerate`, {
      method: "POST",
    })
  },
}

// Rows API
export const rowsAPI = {
  create: async (tableId: number, data: CreateRowRequest): Promise<RowWithCells> => {
    return fetchAPI<RowWithCells>(`/api/tables/${tableId}/rows`, {
      method: "POST",
      body: JSON.stringify({ ...data, table_id: tableId }),
    })
  },

  list: async (tableId: number, params?: GetRowsQueryParams): Promise<RowsListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.cursor) queryParams.append("cursor", params.cursor)
    if (params?.page_size) queryParams.append("page_size", params.page_size.toString())
    if (params?.sort_by_column_id) queryParams.append("sort_by_column_id", params.sort_by_column_id.toString())
    if (params?.sort_asc !== undefined) queryParams.append("sort_asc", params.sort_asc.toString())
    if (params?.filters && params.filters.length > 0) {
      queryParams.append("filters", JSON.stringify(params.filters))
    }

    const queryString = queryParams.toString()
    const endpoint = `/api/tables/${tableId}/rows${queryString ? `?${queryString}` : ""}`
    return fetchAPI<RowsListResponse>(endpoint)
  },

  get: async (tableId: number, rowId: number): Promise<RowWithCells> => {
    return fetchAPI<RowWithCells>(`/api/tables/${tableId}/rows/${rowId}`)
  },

  delete: async (tableId: number, rowId: number): Promise<void> => {
    return fetchAPI<void>(`/api/tables/${tableId}/rows/${rowId}`, {
      method: "DELETE",
    })
  },

  regenerate: async (tableId: number, rowId: number): Promise<void> => {
    return fetchAPI<void>(`/api/tables/${tableId}/rows/${rowId}/regenerate`, {
      method: "POST",
    })
  },
}

// Cells API
export const cellsAPI = {
  update: async (tableId: number, rowId: number, cellId: number, value: string): Promise<CellWithColumn> => {
    return fetchAPI<CellWithColumn>(`/api/tables/${tableId}/rows/${rowId}/cells/${cellId}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    })
  },
}

// CSV Upload API
export const uploadAPI = {
  uploadCsv: async (tableId: number, file: File): Promise<UploadCsvResponse> => {
    const formData = new FormData()
    formData.append("file", file)

    // Get JWT token from localStorage (SSR-safe)
    const token = getToken()

    // Build headers
    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const url = `${API_BASE_URL}/api/tables/${tableId}/upload-csv`
    const response = await fetch(url, {
      method: "POST",
      headers: headers as HeadersInit,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }))
      const errorMessage = error.detail || error.message || `HTTP error! status: ${response.status}`

      // Check if token has expired
      if (
        response.status === 401 &&
        (errorMessage.includes("Token has expired") || errorMessage.includes("token has expired"))
      ) {
        throw new TokenExpiredError(errorMessage)
      }

      throw new Error(errorMessage)
    }

    return response.json()
  },
}
