'use client'

/**
 * Course-level Dashboard — redirects to Assignments.
 *
 * The standalone course dashboard has been removed; the Assignments list is
 * now the landing page. This redirect ensures old links / bookmarks still
 * work.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CourseDashboardPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/assignments')
  }, [router])
  return null
}
