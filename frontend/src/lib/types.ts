// API Schema Types

export enum ColumnTypeEnum {
  TEXT = "text",
  BOOLEAN = "boolean",
  NUMBER = "number",
}

export enum AgentStateEnum {
  NOT_REQUIRED = "not_required",
  AWAITING = "awaiting",
  QUEUED = "queued",
  TRIGGERED = "triggered",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface Table {
  id: number
  title: string
  columns: Record<string, any>
  created_at: string
  modified_at: string
}

export interface Column {
  id: number
  table_id: number
  is_primary: boolean | null
  title: string | null
  prompt: string | null
  type: ColumnTypeEnum
  deleted_at: string | null
  created_at: string
  modified_at: string
}

export interface Row {
  id: number
  table_id: number
  deleted_at: string | null
  created_at: string
  modified_at: string
}

export interface Cell {
  id: number
  row_id: number
  table_id: number
  column_id: number
  value: string
  is_searchable: boolean
  agent_state: AgentStateEnum
  deleted_at: string | null
  created_at: string
  modified_at: string
}

export interface CellWithColumn extends Cell {
  column: Column | null
}

export interface RowWithCells extends Row {
  cells: CellWithColumn[]
}

// Request/Response Types
export interface CreateTableRequest {
  title: string
  columns?: Record<string, any>
}

export interface UpdateTableRequest {
  title?: string
}

export interface CreateColumnRequest {
  table_id: number
  is_primary?: boolean | null
  title?: string | null
  prompt?: string | null
  type: ColumnTypeEnum
}

export interface CreateRowRequest {
  table_id: number
  primary_value?: string | null
}

export interface ColumnFilter {
  column_id: number
  value?: string | null
  min_value?: number | null
  max_value?: number | null
  boolean_value?: boolean | null
}

export interface GetRowsQueryParams {
  cursor?: string
  page_size?: number
  sort_by_column_id?: number
  sort_asc?: boolean
  filters?: ColumnFilter[]
}

export interface RowsListResponse {
  rows: RowWithCells[]
  next_cursor: string | null
  previous_cursor: string | null
}

export interface UploadCsvResponse {
  rows_created: number
  message: string
}

// Column Template Types
export interface ColumnTemplate {
  id: string
  title: string
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>
  prompt: string
  type: ColumnTypeEnum
}
