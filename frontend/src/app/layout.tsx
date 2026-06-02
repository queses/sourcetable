import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthCallbackHandler } from "@/components/AuthCallbackHandler"

export const metadata: Metadata = {
  title: "SourceTable",
  description: "Fullstack Test Task",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthCallbackHandler />
          <ProtectedRoute>{children}</ProtectedRoute>
        </Providers>
      </body>
    </html>
  )
}
