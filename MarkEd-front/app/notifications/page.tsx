'use client'

/**
 * All notifications (the original "View all notifications" page). Restores the
 * source dissertations' notification list with a "Mark all read" action; each
 * row deep-links to its assignment.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Loader2 } from 'lucide-react'
import { DefaultService, NotificationSchema } from '@/src/api'
import { formatDateTime } from '@/lib/date'
import { toast } from 'sonner'

export default function NotificationsPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<NotificationSchema[] | null>(null)

  const load = React.useCallback(() => {
    DefaultService.listNotifications()
      .then((r) => setItems(r.notifications))
      .catch(() => {
        toast.error('Could not load notifications')
        setItems([])
      })
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const markAllRead = async () => {
    try {
      await DefaultService.markNotificationsRead()
      setItems((prev) => (prev ? prev.map((n) => ({ ...n, is_read: true })) : prev))
    } catch {
      toast.error('Could not mark all as read')
    }
  }

  const open = (n: NotificationSchema) => {
    if (!n.is_read) DefaultService.markNotificationRead(n.id).catch(() => {})
    router.push(n.link)
  }

  const hasUnread = !!items?.some((n) => !n.is_read)

  return (
    <div className='mx-auto w-full max-w-[1200px] px-7 pb-12 pt-8'>
      <div className='mb-5 flex flex-wrap items-end justify-between gap-3'>
        <div>
          <div className='text-[23px] font-semibold tracking-[-.5px] text-[#131A26]'>
            Notifications
          </div>
          <div className='mt-0.5 text-[13px] text-[#8A9099]'>
            Deadline reminders and mark releases for your assignments.
          </div>
        </div>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className='inline-flex items-center gap-1.5 rounded-[9px] border border-[#DED8CA] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2C3444] hover:bg-[#F2EFE8]'
          >
            <Check className='h-4 w-4' /> Mark all read
          </button>
        )}
      </div>

      {items === null ? (
        <div className='flex items-center justify-center rounded-[14px] border border-[#EAE5DB] bg-white py-16 text-[#8A9099]'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </div>
      ) : items.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-[14px] border border-[#EAE5DB] bg-white px-7 py-16 text-center'>
          <Bell className='mb-1 h-9 w-9 text-[#A29A8C]' strokeWidth={1.6} />
          <div className='text-[14.5px] font-semibold text-[#2C3444]'>
            No notifications yet
          </div>
          <p className='max-w-sm text-[13px] leading-[1.6] text-[#8A9099]'>
            You&apos;ll be notified here about deadline reminders and when your
            marks are released.
          </p>
        </div>
      ) : (
        <div className='overflow-hidden rounded-[14px] border border-[#EAE5DB] bg-white'>
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`flex w-full gap-3 border-b border-[#F0ECE4] px-5 py-4 text-left last:border-b-0 hover:bg-[#FAF8F4] ${
                n.is_read ? '' : 'bg-[#FBF7EF]'
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                  n.is_read ? 'bg-transparent' : 'bg-[#C0392B]'
                }`}
              />
              <span className='min-w-0 flex-1'>
                <span className='block text-[13.5px] leading-[1.5] text-[#2C3444]'>
                  {n.message}
                </span>
                <span className='mt-0.5 block text-[11.5px] text-[#8A9099]'>
                  {formatDateTime(n.date)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
