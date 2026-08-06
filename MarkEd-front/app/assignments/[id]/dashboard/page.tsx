'use client'

/**
 * Assignment Dashboard — redirect stub.
 *
 * The dashboard tab has been removed: its controls (Release Marks, submission
 * stats, grade distribution, marker queue) now live on the Marking tab, and
 * the peer-review match listing lives on the Peer Reviews tab.
 *
 * This page exists only so that old bookmarks or links to
 * /assignments/[id]/dashboard still land somewhere sensible — it immediately
 * redirects to the Marking tab (submissions for individual, group-marking for
 * group assignments).
 */

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DefaultService } from '@/src/api'

export default function DashboardRedirect() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    if (!params.id) return
    const id = Number(params.id)
    DefaultService.getAssignment(id)
      .then((a) => {
        const target =
          a.assignment_type === 'GROUP' ? 'group-marking' : 'submissions'
        router.replace(`/assignments/${id}/${target}`)
      })
      .catch(() => {
        // Fallback to submissions if the fetch fails
        router.replace(`/assignments/${id}/submissions`)
      })
  }, [params.id, router])

  return null
}
