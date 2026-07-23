'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { DefaultService } from '@/src/api'
import dynamic from 'next/dynamic'

// Dynamically import PDF viewer component
const PDFViewer = dynamic(() => import('@/components/pdf-viewer/PDFViewer'), {
  ssr: false,
})

export default function InstructionPDFPage() {
  const params = useParams()
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const assignments = await DefaultService.getInstructionFileAccessUrl(
          Number(params.id),
          decodeURIComponent(params.filename as string)
            .split('/')
            .pop() as string
        )

        const instructionUrl = assignments.download_url

        if (instructionUrl) {
          setPdfUrl(instructionUrl)
        } else {
          setError('PDF not found')
        }
      } catch (err) {
        setError('Failed to fetch assignment instructions')
        console.error('Error fetching assignment:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAssignment()
  }, [params.id, params.filename])

  if (loading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex h-screen items-center justify-center text-red-500'>
        {error}
      </div>
    )
  }

  return (
    <div className='h-screen w-full'>
      {pdfUrl && <PDFViewer url={pdfUrl} />}
    </div>
  )
}
