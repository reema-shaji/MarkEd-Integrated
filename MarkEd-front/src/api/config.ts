// To generate the api client types, run `npm run generate-api`

import { OpenAPI } from './index'

const TOKEN_KEY = 'marked_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

/**
 * Configure the generated API client.
 *
 * Auth is now bearer-token (like the earlier unified build), not the session
 * cookie: the SPA and the API can therefore live on different origins (Vercel +
 * Render) without hitting third-party-cookie blocking. The token is read from
 * localStorage on every request via the TOKEN resolver, so it stays current
 * after login/logout without re-initialising.
 */
export const initializeApi = () => {
  OpenAPI.BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost'
  OpenAPI.TOKEN = async () => getToken() ?? ''
  // No cookies needed cross-origin now that auth is a bearer token.
  OpenAPI.WITH_CREDENTIALS = false
}
