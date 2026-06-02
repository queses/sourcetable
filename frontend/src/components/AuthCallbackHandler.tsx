"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { setToken } from "@/lib/auth-storage"

/**
 * Component to handle Auth0 callback and extract JWT token from URL fragment
 * This component runs on mount and extracts token from window.location.hash
 */
export function AuthCallbackHandler() {
  const router = useRouter()

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return

    // Check if we have token in the URL fragment
    const hash = window.location.hash
    if (!hash || hash.length <= 1) return

    // Parse URL fragment (format: #token=...&redirect=...)
    const params = new URLSearchParams(hash.substring(1))
    const token = params.get("token")

    if (token) {
      try {
        // Store JWT token in localStorage
        setToken(token)

        // Clear the hash from URL
        window.history.replaceState(null, "", window.location.pathname + window.location.search)

        // Redirect to home or the redirect path if provided
        const redirectPath = params.get("redirect") || "/"
        router.push(redirectPath)
      } catch (error) {
        console.error("Error storing token:", error)
        // Redirect to home on error
        router.push("/")
      }
    }
  }, [router])

  // This component doesn't render anything
  return null
}
