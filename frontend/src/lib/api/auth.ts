import { getUserInfo, clearTokens, getToken } from "../auth-storage"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export interface UserProfile {
  user: {
    sub: string
    email?: string
    name?: string
    picture?: string
    [key: string]: any
  }
  token: boolean
}

export const authAPI = {
  /**
   * Get current user profile from JWT token in localStorage
   */
  getProfile: async (): Promise<UserProfile> => {
    // Read from localStorage (SSR-safe)
    const userinfo = getUserInfo()
    const token = getToken()

    if (!userinfo || !token) {
      throw new Error("Not authenticated")
    }

    return {
      user: userinfo,
      token: !!token,
    }
  },

  /**
   * Redirect to login endpoint
   * This will redirect the browser to Auth0 login page
   * Automatically includes the current pathname and query params as redirect parameter
   */
  login: (): void => {
    if (typeof window === "undefined") return
    // Get current pathname and query params from window.location
    let loginUrl = `${API_BASE_URL}/api/auth/login`
    const currentPath = window.location.pathname + window.location.search
    if (currentPath) {
      // URL encode the redirect path (includes pathname + query params)
      const encodedPath = encodeURIComponent(currentPath)
      loginUrl += `?redirect=${encodedPath}`
    }
    window.location.href = loginUrl
  },

  /**
   * Logout user
   * Clears localStorage tokens and redirects to Auth0 logout
   */
  logout: (): void => {
    if (typeof window === "undefined") return
    // Clear tokens from localStorage
    clearTokens()
    // Redirect to backend logout endpoint (which redirects to Auth0)
    window.location.href = `${API_BASE_URL}/api/auth/logout`
  },
}
