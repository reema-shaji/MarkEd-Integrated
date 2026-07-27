'use client'

/**
 * Assignment-level group management alias (report B15).
 *
 * The "Group Management" tab manages the assignment's group category, which
 * lives at the course-level /groupsets/[group_set_id] page. This route makes the
 * assignment-scoped /groups URL valid — it resolves the assignment's group set
 * and redirects there instead of 404-ing.
 */

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DefaultService } from '@/src/api'
import { Skeleton } from '@/components/ui/skeleton'

export default function AssignmentGroupsRedirect() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  useEffect(() => {
    if (!id || Number.isNaN(id)) return
    DefaultService.getAssignment(id)
      .then((a) =>
        router.replace(
          a.group_set_id
            ? `/groupsets/${a.group_set_id}`
            : `/assignments/${id}/dashboard`
        )
      )
      .catch(() => router.replace(`/assignments/${id}/dashboard`))
  }, [id, router])

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <Skeleton className='h-64 w-full rounded-[14px]' />
    </div>
  )
}
