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

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      try {
        const response = await DefaultService.getMyCourses()
        if (cancelled) return
        setCourses(response)

        // Restore the previous choice if it is still one of the user's courses,
        // otherwise fall back to the first.
        const stored = Number(
          window.localStorage.getItem(storageKey(user.id)) ?? NaN
        )
        const valid = response.some((c) => c.id === stored)
        setCurrentCourseIdState(valid ? stored : (response[0]?.id ?? null))
      } catch {
        if (!cancelled) toast.error('Could not load your courses')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

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
