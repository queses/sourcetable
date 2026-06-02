"use client"

import { COLUMN_TEMPLATES } from "@/lib/column-templates"
import { ColumnTemplate } from "@/lib/types"

interface ColumnTemplatesProps {
  onSelectTemplate: (template: ColumnTemplate) => void
}

export function ColumnTemplates({ onSelectTemplate }: ColumnTemplatesProps) {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Templates</h3>
      </div>
      <div className="space-y-1">
        {COLUMN_TEMPLATES.map((template) => {
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-100"
            >
              <template.icon className="h-4 w-4 text-gray-600" />
              <span className="text-sm">{template.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
