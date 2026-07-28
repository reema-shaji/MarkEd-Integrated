'use client'

/**
 * Notification bell — restores the navbar notifications from the source
 * dissertations: a red unread badge, a dropdown of recent notifications with
 * "Mark all read" (the original dismiss()) and "View all", each item deep-links
 * to its assignment. Unlike the originals, the unread count is populated for
 * every role (the source only wired it for teachers).
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DefaultService, NotificationSchema } from '@/src/api'
import { formatDateTime } from '@/lib/date'

export function NotificationBell({ active }: { active?: boolean }) {
  const router = useRouter()
  const [unread, setUnread] = React.useState(0)
  const [items, setItems] = React.useState<NotificationSchema[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  const refreshCount = React.useCallback(() => {
    DefaultService.getUnreadNotificationCount()
      .then((r) => setUnread(r.unread_count ?? 0))
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 60000)
    return () => clearInterval(t)
  }, [refreshCount])

  const loadList = React.useCallback(() => {
    setLoading(true)
    DefaultService.listNotifications()
      .then((r) => {
        setItems(r.notifications)
        setUnread(r.unread_count ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (o) loadList()
  }

  const markAllRead = async () => {
    try {
      await DefaultService.markNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnread(0)
    } catch {
      /* ignore */
    }
  }

  const openNotification = (n: NotificationSchema) => {
    setOpen(false)
    if (!n.is_read) {
      DefaultService.markNotificationRead(n.id)
        .then((r) => setUnread(r.unread_count ?? 0))
        .catch(() => {})
    }
    router.push(n.link)
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          title='Notifications'
          className={`relative flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] hover:bg-warm-100 ${
            active ? 'bg-warm-200 text-ink' : 'text-muted2'
          }`}
        >
          <Bell className='h-[18px] w-[18px]' strokeWidth={1.8} />
          {unread > 0 && (
            <span className='absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#C0392B] px-1 text-[10px] font-bold leading-none text-white'>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='w-[360px] rounded-[13px] p-0'
      >
        <div className='flex items-center justify-between border-b border-line-soft px-3.5 py-2.5'>
          <span className='text-[12px] font-bold tracking-[.6px] text-faint'>
            NOTIFICATIONS
          </span>
          {items.some((n) => !n.is_read) && (
            <button
              onClick={markAllRead}
              className='inline-flex items-center gap-1 text-[12px] font-semibold text-royal hover:text-royal-hover'
            >
              <Check className='h-3.5 w-3.5' /> Mark all read
            </button>
          )}
        </div>

        <div className='max-h-[340px] overflow-y-auto'>
          {loading ? (
            <div className='flex items-center justify-center py-8 text-faint'>
              <Loader2 className='h-5 w-5 animate-spin' />
            </div>
          ) : items.length === 0 ? (
            <div className='px-4 py-8 text-center text-[13px] text-[#8A9099]'>
              No notifications yet.
            </div>
          ) : (
            items.slice(0, 8).map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`flex w-full gap-2.5 border-b border-line-soft px-3.5 py-3 text-left last:border-b-0 hover:bg-paper ${
                  n.is_read ? '' : 'bg-[#FBF7EF]'
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                    n.is_read ? 'bg-transparent' : 'bg-[#C0392B]'
                  }`}
                />
                <span className='min-w-0 flex-1'>
                  <span className='block text-[13px] leading-[1.45] text-[#2C3444]'>
                    {n.message}
                  </span>
                  <span className='mt-0.5 block text-[11px] text-faint'>
                    {formatDateTime(n.date)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <button
          onClick={() => {
            setOpen(false)
            router.push('/notifications')
          }}
          className='block w-full border-t border-line-soft px-3.5 py-2.5 text-center text-[12.5px] font-semibold text-royal hover:bg-paper'
        >
          View all notifications
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
