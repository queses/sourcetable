"use client"

import { useParams } from "next/navigation"
import { Sidebar } from "@/components/Sidebar"

interface TableLayoutProps {
  children: React.ReactNode
}

export default function TableLayout({ children }: TableLayoutProps) {
  const params = useParams()
  const id = params.id as string
  const tableId = parseInt(id, 10)

  // Use tableId directly if valid, otherwise null
  const currentTableId = !isNaN(tableId) ? tableId : null

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <Sidebar currentTableId={currentTableId} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </main>
  )
}
