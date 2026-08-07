'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  AssignmentSchema,
  DefaultService,
  PeerReviewSchema,
  PeerReviewSchemaWithStudent,
} from '@/src/api'
import { toast } from 'sonner'
import { useUser } from './user-context'

interface AssignmentStatus {
  isOpen: boolean
  message: string
}

interface AssignmentContextType {
  assignments: AssignmentSchema[]
  currentAssignment: AssignmentSchema | null
  currentAssignmentId: number | null
  peerReviews: PeerReviewSchema[]
  submissionStatus: AssignmentStatus
  peerReviewStatus: AssignmentStatus
  markerAllocations: PeerReviewSchemaWithStudent[]
  fetchMarkerAllocations: (assignmentId: number) => Promise<void>
  setCurrentAssignmentId: (id: number) => void
  refetchAssignments: () => Promise<void>
  togglePeerReviewComplete: (
    assignmentId: number,
    peerReviewId: number
  ) => Promise<void>
  isPeerReviewComplete: (peerReviewId: number) => boolean
}

const AssignmentContext = createContext<AssignmentContextType | undefined>(
  undefined
)

export function AssignmentProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [assignments, setAssignments] = useState<AssignmentSchema[]>([])
  const [currentAssignmentId, setCurrentAssignmentId] = useState<number | null>(
    null
  )
  const [peerReviews, setPeerReviews] = useState<PeerReviewSchema[]>([])
  const [completedPeerReviews, setCompletedPeerReviews] = useState<Set<number>>(
    new Set()
  )
  const [markerAllocations, setMarkerAllocations] = useState<
    PeerReviewSchemaWithStudent[]
  >([])
  const { user } = useUser()

  const currentAssignment =
    assignments.find((a) => a.id === currentAssignmentId) || null

  const fetchAssignments = async () => {
    try {
      const response = await DefaultService.getAssignments()
      setAssignments(response)
    } catch (error) {
      console.error('Failed to fetch assignments:', error)
    }
  }

  const fetchPeerReviews = async () => {
    if (!currentAssignmentId) return
    try {
      const response = await DefaultService.getPeerReviews(currentAssignmentId)
      setPeerReviews(response)

      // Initialize completed reviews
      const completed = new Set<number>()
      response.forEach((review) => {
        if (review.status === 'COMPLETED') {
          completed.add(review.submission_id)
        }
      })
      setCompletedPeerReviews(completed)
    } catch (error) {
      console.error('Failed to fetch peer reviews:', error)
    }
  }

  const fetchMarkerAllocations = async (assignmentId: number) => {
    if (user?.isMarker) {
      try {
        const allocations =
          await DefaultService.getMarkerAllocations(assignmentId)
        setMarkerAllocations(allocations)
      } catch (error) {
        console.error('Error fetching marker allocations:', error)
        setMarkerAllocations([])
      }
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [])

  useEffect(() => {
    if (currentAssignmentId) {
      fetchPeerReviews()
      fetchMarkerAllocations(currentAssignmentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAssignmentId, user])

  // The assignments list is fetched once on mount, so a deep link or a
  // just-created assignment can be absent from it — which leaves the header
  // title, Edit button and tabs blank. Fetch that single assignment on demand
  // and merge it in so the header always populates.
  useEffect(() => {
    if (!currentAssignmentId) return
    if (assignments.some((a) => a.id === currentAssignmentId)) return
    DefaultService.getAssignment(currentAssignmentId)
      .then((a) =>
        setAssignments((prev) =>
          prev.some((x) => x.id === a.id)
            ? prev
            : [...prev, a as AssignmentSchema]
        )
      )
      .catch(() => {})
  }, [currentAssignmentId, assignments])

  const getSubmissionStatus = (
    assignment: AssignmentSchema | null
  ): AssignmentStatus => {
    if (!assignment) return { isOpen: false, message: 'No assignment selected' }

    const now = new Date()
    // release_date is nullable: only peer review assignments are guaranteed to
    // set one, so an assignment without it is treated as already released.
    const releaseDate = assignment.release_date
      ? new Date(assignment.release_date)
      : null
    const deadline = new Date(assignment.deadline)

    if (releaseDate && now < releaseDate) {
      return {
        isOpen: false,
        message: `Submissions open on ${releaseDate.toLocaleDateString()}`,
      }
    } else if (now >= deadline) {
      return {
        isOpen: false,
        message: 'Submissions are now closed',
      }
    }
    return {
      isOpen: true,
      message: `Submissions close on ${deadline.toLocaleDateString()}`,
    }
  }

  const getPeerReviewStatus = (
    assignment: AssignmentSchema | null
  ): AssignmentStatus => {
    if (!assignment) return { isOpen: false, message: 'No assignment selected' }
    // Peer review is a per-assignment toggle in the unified model, so this can
    // now be called for assignments that have no review configuration at all.
    if (!assignment.peer_review_enabled) {
      return { isOpen: false, message: 'Peer review is not enabled for this assignment' }
    }

    const now = new Date()
    const deadline = new Date(assignment.deadline)
    const reviewDeadline = assignment.review_deadline
      ? new Date(assignment.review_deadline)
      : null

    if (now < deadline) {
      return {
        isOpen: false,
        message: 'Peer reviews will open after the submission deadline',
      }
    } else if (!assignment.is_peer_review_matching_complete) {
      return {
        isOpen: false,
        message: 'Peer review matching in progress',
      }
    } else if (reviewDeadline && now > reviewDeadline) {
      return {
        isOpen: false,
        message: 'Peer review deadline has passed',
      }
    }
    return {
      isOpen: true,
      message: 'Peer reviews are now open',
    }
  }

  const togglePeerReviewComplete = async (
    assignmentId: number,
    peerReviewId: number
  ) => {
    try {
      const response = await DefaultService.togglePeerReviewCompleteness(
        assignmentId,
        peerReviewId
      )

      if (!response.success) {
        toast.error(response.message)
        return
      }

      if (response.is_completed) {
        setCompletedPeerReviews((prev) => new Set(prev).add(peerReviewId))
        toast.success('Peer review marked as complete')
      } else {
        setCompletedPeerReviews((prev) => {
          const newSet = new Set(prev)
          newSet.delete(peerReviewId)
          return newSet
        })
        toast.success('Peer review marked as incomplete')
      }
    } catch (error) {
      toast.error(error as string)
      console.error('Failed to toggle peer review completeness:', error)
    }
  }

  const isPeerReviewComplete = (peerReviewId: number): boolean => {
    return completedPeerReviews.has(peerReviewId)
  }

  return (
    <AssignmentContext.Provider
      value={{
        assignments,
        currentAssignment,
        currentAssignmentId,
        peerReviews,
        submissionStatus: getSubmissionStatus(currentAssignment),
        peerReviewStatus: getPeerReviewStatus(currentAssignment),
        markerAllocations,
        fetchMarkerAllocations,
        setCurrentAssignmentId,
        refetchAssignments: fetchAssignments,
        togglePeerReviewComplete,
        isPeerReviewComplete,
      }}
    >
      {children}
    </AssignmentContext.Provider>
  )
}

export function useAssignment() {
  const context = useContext(AssignmentContext)
  if (context === undefined) {
    throw new Error('useAssignment must be used within an AssignmentProvider')
  }
  return context
}
