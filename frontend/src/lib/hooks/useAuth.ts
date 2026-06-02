import { useState, useEffect } from "react"
import { authAPI, UserProfile } from "@/lib/api/auth"
import { getUserInfo, isAuthenticated as checkAuth } from "@/lib/auth-storage"

export function useAuth() {
  const [data, setData] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      setIsLoading(false)
      return
    }

    // Try to get profile from JWT token in localStorage
    const loadProfile = async () => {
      try {
        const profile = await authAPI.getProfile()
        setData(profile)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Not authenticated"))
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  const isAuthenticated = !!data && !error && checkAuth()
  const user = data?.user

  const refetch = async () => {
    setIsLoading(true)
    try {
      const profile = await authAPI.getProfile()
      setData(profile)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Not authenticated"))
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    refetch,
    login: authAPI.login,
    logout: authAPI.logout,
  }
}
