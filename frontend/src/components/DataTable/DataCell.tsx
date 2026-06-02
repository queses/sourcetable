"use client"

import { Badge } from "@/components/ui/badge"
import { ColumnTypeEnum, AgentStateEnum } from "@/lib/types"

interface DataCellProps {
  value: string
  type: ColumnTypeEnum
  agentState?: AgentStateEnum
  editable?: boolean
}

export function DataCell({ value, type, agentState }: DataCellProps) {
  const isLoading =
    agentState === AgentStateEnum.QUEUED ||
    agentState === AgentStateEnum.TRIGGERED ||
    agentState === AgentStateEnum.AWAITING

  if (isLoading) {
    return (
      <div className="flex min-h-[32px] items-center">
        <span className="italic text-muted-foreground">{humanizeAgentState(agentState)}</span>
      </div>
    )
  }

  if (value === "" && agentState === AgentStateEnum.COMPLETED) {
    return (
      <div className="-mx-2 flex min-h-[32px] items-center">
        {<span className="italic text-muted-foreground/50">Empty</span>}
      </div>
    )
  }

  if (type === ColumnTypeEnum.BOOLEAN) {
    return (
      <div className="flex min-h-[32px] items-center">
        <Badge variant="outline" className="rounded-full border-gray-300 bg-gray-100 px-2.5 py-0.5 text-gray-700">
          {value === "1" ? "Yes" : "No"}
        </Badge>
      </div>
    )
  }

  if (type === ColumnTypeEnum.NUMBER) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="rounded-full border-gray-300 bg-gray-100 px-2.5 py-0.5 text-gray-700">
          {value}
        </Badge>
      </div>
    )
  }

  const isUrl = value && isValidUrl(value)

  return (
    <div className="-mx-2 flex min-h-[32px] items-center">
      {value ? (
        isUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )
      ) : (
        <span className="italic text-muted-foreground/50">{humanizeAgentState(agentState)}</span>
      )}
    </div>
  )
}

function humanizeAgentState(state?: AgentStateEnum): string {
  if (!state) return ""
  return state
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
