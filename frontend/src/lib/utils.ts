import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type React from "react"
import { RowWithCells, AgentStateEnum } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to check if a row has any cells with non-final agent states
export function hasActiveAgents(row: RowWithCells): boolean {
  return row.cells.some((cell) => {
    const state = cell.agent_state
    return state === AgentStateEnum.QUEUED || state === AgentStateEnum.TRIGGERED || state === AgentStateEnum.AWAITING
  })
}

// Calculate popover position to prevent viewport overflow
export function calculatePopoverPosition(
  anchorEl: HTMLElement | null | undefined,
  popoverWidth: number = 320,
  padding: number = 16
): React.CSSProperties {
  if (!anchorEl) return {}

  const rect = anchorEl.getBoundingClientRect()
  const viewportWidth = window.innerWidth

  // Calculate left position (default: align to left edge of anchor with small offset)
  let left = rect.left - padding

  // Check if popover would overflow on the right side
  if (left + popoverWidth > viewportWidth - padding) {
    // Align to right edge of anchor instead
    left = rect.right - popoverWidth + padding
  }

  // Ensure popover doesn't overflow on the left side
  if (left < padding) {
    left = padding
  }

  return {
    position: "absolute",
    top: `${rect.bottom + 4}px`,
    left: `${left}px`,
  }
}
