'use client'
import { useParams } from 'next/navigation'
import {
  DefaultService,
  PeersLastSubmissionResponse,
  MySubmissionResultSchema,
} from '@/src/api'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
// Load the PDF viewer client-side only: it evaluates pdfjs at module scope,
// which throws during server-side rendering ("Object.defineProperty on
// non-object"). ssr:false keeps it off the server.
const ResultsPDFViewer = dynamic(
  () => import('@/components/pdf-viewer/ResultsPDFViewer'),
  { ssr: false }
)
import Link from 'next/link'
import { Telescope, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

// Student-facing mark for an individual assignment. Restores the mark students
// saw on the original student home (Tomas' student/views.home): score + rubric
// breakdown, revealed only once marking is finished, else a "not released" note
// mirroring the group-result page.
function MarkCard({ result }: { result: MySubmissionResultSchema }) {
  if (!result.released) {
    return (
      <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-7 text-center'>
        <div className='text-[14.5px] font-semibold text-[#2C3444]'>
          Marks not yet released
        </div>
        <div className='mt-1.5 text-[13px] leading-[1.6] text-[#8A9099]'>
          Your mark and rubric feedback will appear here once your marker has
          finished marking your submission.
        </div>
      </div>
    )
  }

  return (
    <div className='rounded-[14px] border border-[#EAE5DB] bg-white p-6'>
      <div className='flex items-center justify-between gap-4'>
        <div>
          <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            Your mark
          </div>
          <div className='mt-1 flex items-baseline gap-2'>
            <span className='text-[34px] font-semibold -tracking-[.8px] tabular-nums text-[#131A26]'>
              {result.score}
            </span>
            <span className='text-[16px] text-[#8A9099]'>
              / {result.total}
            </span>
          </div>
        </div>
        <div className='rounded-[12px] bg-[#131A26] px-5 py-3 text-center'>
          <div className='text-[10px] font-semibold uppercase tracking-[.85px] text-white/60'>
            Percentage
          </div>
          <div className='mt-0.5 text-[26px] font-semibold tabular-nums text-white'>
            {Math.round(result.percentage)}%
          </div>
        </div>
      </div>

      {result.breakdown.length > 0 && (
        <div className='mt-5 border-t border-[#F0EBE1]'>
          <div className='pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.85px] text-[#A29A8C]'>
            Rubric breakdown
          </div>
          <div className='divide-y divide-[#F0EBE1]'>
            {result.breakdown.map((c, i) => (
              <div
                key={i}
                className='flex items-start justify-between gap-4 py-3'
              >
                <div className='min-w-0'>
                  <div className='text-[13.5px] font-medium text-[#2C3444]'>
                    {c.name}
                  </div>
                  {c.feedback && (
                    <div className='mt-0.5 text-[12.5px] leading-[1.55] text-[#5A6070]'>
                      {c.feedback}
                    </div>
                  )}
                </div>
                <div className='shrink-0 font-mono text-[13px] tabular-nums text-[#131A26]'>
                  {c.score} / {c.max}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ResultsPage = () => {
  const params = useParams()
  const [submission, setSubmission] =
    useState<PeersLastSubmissionResponse | null>(null)
  const [submissionId, setSubmissionId] = useState<number | null>(null)
  const [result, setResult] = useState<MySubmissionResultSchema | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true)

      // The submission file (for the annotation viewer) and the mark are fetched
      // independently — a missing file shouldn't hide the mark, and vice versa.
      try {
        const response = await DefaultService.getLastSubmission(
          Number(params['id'])
        )
        if (response?.id) {
          setSubmissionId(response.id)
          const fileResponse = await DefaultService.getPeersLastSubmission(
            Number(params['id']),
            response.id
          )
          setSubmission(fileResponse)
        }
      } catch (error) {
        // A 404 simply means the student hasn't submitted yet — that's the
        // empty state below, not a failure.
        const status = (error as { status?: number })?.status
        if (status !== 404) {
          toast.error('Failed to load your submission')
        }
      }

      try {
        const res = await DefaultService.getMySubmissionResult(
          Number(params['id'])
        )
        setResult(res)
      } catch (error) {
        // 404 = no submission to mark; leave the mark card out.
        const status = (error as { status?: number })?.status
        if (status !== 404) {
          toast.error('Failed to load your mark')
        }
      }

      setIsLoading(false)
    }

    fetchResults()
  }, [params])

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-[1200px] space-y-5 px-7 pb-12 pt-8'>
        <Skeleton className='h-8 w-40 rounded-[9px]' />
        <Skeleton className='h-4 w-full max-w-md' />
        <Skeleton className='h-[70vh] w-full rounded-[14px]' />
      </div>
    )
  }

  // Nothing at all — no submission and no mark: prompt to submit.
  if (!submission?.pre_signed_file_url && !submissionId && !result) {
    return (
      <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8 duration-1000 animate-in fade-in'>
        <div className='mb-1 text-[21px] font-semibold -tracking-[.45px] text-[#131A26]'>
          Results
        </div>
        <div className='mb-5 text-[14px] text-[#5A6070]'>
          Your mark and feedback for this assignment.
        </div>
        <div className='flex flex-col items-center gap-2 rounded-[14px] border border-[#EAE5DB] bg-white px-7 py-14 text-center'>
          <Telescope className='mb-1 h-9 w-9 text-[#A29A8C]' />
          <div className='text-[14.5px] font-semibold text-[#2C3444]'>
            Nothing to see here
          </div>
          <p className='max-w-sm text-[13px] leading-[1.6] text-[#8A9099]'>
            No submission found. You need to submit your work before you can see
            feedback.
          </p>
          <Button
            asChild
            className='mt-3 rounded-[9px] bg-[#131A26] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#243247]'
          >
            <Link href={`/assignments/${params['id']}/submit`}>
              <FileText className='mr-2 h-4 w-4' />
              Go to submit page
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='pb-12 duration-500 animate-in fade-in'>
      <div className='mx-auto w-full max-w-[1200px] px-7 pt-8'>
        <div className='mb-1 text-[21px] font-semibold -tracking-[.45px] text-[#131A26]'>
          Results
        </div>
        <div className='mb-5 text-[14px] text-[#5A6070]'>
          Your mark and feedback for this assignment.
        </div>

        {result && <MarkCard result={result} />}
      </div>

      {submission?.pre_signed_file_url && submissionId && (
        <div className='mt-8'>
          <div className='mx-auto mb-1 w-full max-w-[1200px] px-7 text-[13px] font-semibold text-[#2C3444]'>
            Feedback on your submission
          </div>
          <ResultsPDFViewer
            url={submission.pre_signed_file_url}
            assignmentId={Number(params['id'])}
            submissionId={submissionId}
          />
        </div>
      )}
    </div>
  )
}

export default ResultsPage
