/**
 * SSR-safe localStorage utilities for JWT token management
 * All functions check for window availability to prevent SSR errors
 */

const TOKEN_KEY = "auth_token"

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined"
}

/**
 * Decode JWT token payload (without verification)
 * Note: This only decodes the token, verification happens on the backend
 */
function decodeJWTPayload(token: string): any | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    // Decode the payload (second part)
    // JWT uses base64url encoding, need to convert to base64
    const payload = parts[1]
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    // Add padding if needed
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    return JSON.parse(decoded)
  } catch (error) {
    console.error("Error decoding JWT payload:", error)
    return null
  }
}

/**
 * Get JWT token from localStorage
 */
export function getToken(): string | null {
  if (!isBrowser()) return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch (error) {
    console.error("Error reading token from localStorage:", error)
    return null
  }
}

/**
 * Get user info from JWT token
 */
export function getUserInfo(): any | null {
  const token = getToken()
  if (!token) return null
  return decodeJWTPayload(token)
}

/**
 * Store JWT token in localStorage
 */
export function setToken(token: string): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch (error) {
    console.error("Error storing token in localStorage:", error)
  }
}

/**
 * Clear token from localStorage
 */
export function clearTokens(): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch (error) {
    console.error("Error clearing token from localStorage:", error)
  }
}

/**
 * Check if user is authenticated (has token)
 */
export function isAuthenticated(): boolean {
  return !!getToken()
}
