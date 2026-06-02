"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/lib/hooks/useAuth"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute component that redirects to login if user is not authenticated
 * Wraps the entire app to ensure all routes are protected
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, login } = useAuth()
  const hasRedirected = useRef(false)

  // Redirect to login immediately when we detect the user is not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true
      login()
    }
  }, [isAuthenticated, isLoading, login])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  // If not authenticated, redirect immediately (don't show UI)
  if (!isAuthenticated) {
    // The useEffect above will trigger the redirect
    // Show loading while redirect happens
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <div className="text-sm text-muted-foreground">Redirecting to login...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
