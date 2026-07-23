'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

interface StatusResponse {
  message: string
  color: string
  link?: string
}

export default function WarningBanner() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isClosing, setIsClosing] = useState(false)
  const [lastDismissedMessage, setLastDismissedMessage] = useState<string>('')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          'https://web.tomasmaillo.com/marked-status'
        )
        if (!response.ok) return

        const data = await response.json()
        if (data.message && data.message !== lastDismissedMessage) {
          setStatus(data)
          setIsVisible(true)
          setIsClosing(false)
        }
      } catch {
        return
      }
    }

    // Check immediately on mount
    checkStatus()

    // Set up interval only when tab is visible
    let intervalId: NodeJS.Timeout
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(intervalId)
      } else {
        checkStatus()
        intervalId = setInterval(checkStatus, 60000) // Check every minute
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    intervalId = setInterval(checkStatus, 60000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [lastDismissedMessage])

  const handleClose = () => {
    setIsClosing(true)
    setLastDismissedMessage(status?.message || '')
    setTimeout(() => setIsVisible(false), 300) // Match transition duration
  }

  if (!status?.message || !isVisible) return null

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-[20] ml-16 w-full overflow-hidden transition-all duration-300 ease-in-out ${
        isClosing ? 'h-0' : 'h-8'
      }`}
      style={{ backgroundColor: status.color }}
    >
      <div className='flex h-8 items-center justify-center gap-6'>
        <div className='truncate text-center text-sm text-white'>
          {status.link ? (
            <Link href={status.link} className='underline'>
              {status.message}
            </Link>
          ) : (
            status.message
          )}
        </div>
        <button
          onClick={handleClose}
          className='p-1 text-white hover:opacity-75'
          aria-label='Close banner'
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
