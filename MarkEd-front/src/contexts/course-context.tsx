'use client'

/**
 * Course context — backs the sidebar's course switcher.
 *
 * All three source codebases scope every view to a course. Hao and Mingyue did
 * it with course cards on the home page; Tomas's deployment was a single course
 * so he never needed a selector. The unified navigation makes the course an
 * explicit *context filter*: changing it changes which assignments and data are
 * shown, but never which navigation items exist (Design PRD §3.1).
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CourseSchema, DefaultService } from '@/src/api'
import { toast } from 'sonner'
import { getToken } from '@/src/api/config'
import { useUser } from './user-context'

interface CourseContextType {
  courses: CourseSchema[]
  currentCourse: CourseSchema | null
  currentCourseId: number | null
  setCurrentCourseId: (id: number) => void
  isLoading: boolean
}

const CourseContext = createContext<CourseContextType | undefined>(undefined)

/** Remembered per user, so one person's choice never leaks into another's session. */
const storageKey = (userId?: number) =>
  userId ? `marked_course_${userId}` : 'marked_course'

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [courses, setCourses] = useState<CourseSchema[]>([])
  const [currentCourseId, setCurrentCourseIdState] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch courses as soon as there's a token — getMyCourses only needs auth,
  // not the resolved user object, so this runs in parallel with getCurrentUser
  // instead of waiting behind it (one fewer round trip on first load).
  useEffect(() => {
    if (typeof window === 'undefined' || !getToken()) return
    let cancelled = false
    DefaultService.getMyCourses()
      .then((response) => {
        if (cancelled) return
        setCourses(response)
        setCurrentCourseIdState((prev) => prev ?? response[0]?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load your courses')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Once the user is known, restore their remembered course selection.
  useEffect(() => {
    if (!user || courses.length === 0) return
    const stored = Number(window.localStorage.getItem(storageKey(user.id)) ?? NaN)
    if (courses.some((c) => c.id === stored)) setCurrentCourseIdState(stored)
  }, [user, courses])

  const setCurrentCourseId = useCallback(
    (id: number) => {
      setCurrentCourseIdState(id)
      if (user) window.localStorage.setItem(storageKey(user.id), String(id))
    },
    [user]
  )

  const currentCourse = courses.find((c) => c.id === currentCourseId) ?? null

  return (
    <CourseContext.Provider
      value={{
        courses,
        currentCourse,
        currentCourseId,
        setCurrentCourseId,
        isLoading,
      }}
    >
      {children}
    </CourseContext.Provider>
  )
}

export function useCourse() {
  const context = useContext(CourseContext)
  if (context === undefined) {
    throw new Error('useCourse must be used within a CourseProvider')
  }
  return context
}
