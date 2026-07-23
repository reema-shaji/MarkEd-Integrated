'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { UserSchema, DefaultService } from '@/src/api'

interface ExtendedUserSchema extends UserSchema {
  isStudent: boolean
  isAcademic: boolean
  isMarker: boolean
  isTA: boolean
  isStaff: boolean // Academic, Marker or TA
}

interface UserContextType {
  user: ExtendedUserSchema | null
  refetchUser: () => Promise<void>
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedUserSchema | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const response = await DefaultService.getCurrentUser()
      const extendedUser: ExtendedUserSchema = {
        ...response,
        isStudent: response.role === 'S',
        isAcademic: response.role === 'A',
        isMarker: response.role === 'M',
        isTA: response.role === 'T',
        isStaff:
          response.role === 'A' ||
          response.role === 'M' ||
          response.role === 'T',
      }
      setUser(extendedUser)
    } catch (error: unknown) {
      setUser(null)
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 401
      ) {
        window.location.href = '/login'
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()

    let intervalId: NodeJS.Timeout | null = null

    const startInterval = () => {
      fetchUser() // Fetch immediately when tab becomes active
      intervalId = setInterval(fetchUser, 1 * 60 * 1000) // Check every minute
    }

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    // Start/stop interval based on visibility
    if (document.hidden) {
      stopInterval()
    } else {
      startInterval()
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopInterval()
      } else {
        startInterval()
      }
    })

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', () => {
        if (document.hidden) {
          stopInterval()
        } else {
          startInterval()
        }
      })
    }
  }, [])

  return (
    <UserContext.Provider
      value={{
        user,
        refetchUser: fetchUser,
        isLoading,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
