'use client'

/**
 * Canonical /submission route (report B1/L2).
 *
 * The student "Submission" tab shows the submit form for individual work and
 * the shared workspace for group work, which live at /submit and /workspace.
 * This alias makes the /submission URL itself valid — it dispatches to the
 * right one by assignment type instead of 404-ing.
 */

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DefaultService } from '@/src/api'
import { Skeleton } from '@/components/ui/skeleton'

export default function SubmissionRedirect() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  useEffect(() => {
    if (!id || Number.isNaN(id)) return
    DefaultService.getAssignment(id)
      .then((a) =>
        router.replace(
          `/assignments/${id}/${a.assignment_type === 'GROUP' ? 'workspace' : 'submit'}`
        )
      )
      .catch(() => router.replace(`/assignments/${id}/submit`))
  }, [id, router])

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <Skeleton className='h-64 w-full rounded-[14px]' />
    </div>
  )
}
