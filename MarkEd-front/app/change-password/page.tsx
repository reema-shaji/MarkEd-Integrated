'use client'

/**
 * Change-password page. Reached on first login (Tomas's must_change_password,
 * PF-12) or from account settings. A password change revokes all tokens
 * server-side, so afterwards the user is sent back to log in.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultService } from '@/src/api'
import { clearToken, initializeApi } from '@/src/api/config'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

initializeApi()

export default function ChangePasswordPage() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')

    setSubmitting(true)
    try {
      await DefaultService.apiChangePassword({
        current_password: current,
        new_password: next,
      })
      // The change revoked every token, so send the user back to log in.
      clearToken()
      toast.success('Password updated. Please log in again.')
      router.replace('/login')
    } catch (err) {
      const status = (err as { status?: number })?.status
      setError(
        status === 400
          ? 'Your current password is incorrect.'
          : 'Could not update your password. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-[#F5F3EF] p-8'>
      <div className='w-full max-w-[440px]'>
        <div className='mb-[22px] flex items-baseline justify-center gap-[9px]'>
          <span className='text-[20px] font-bold tracking-[-0.5px] text-[#131A26]'>
            Mark<span className='text-[#B4832F]'>Ed</span>
          </span>
        </div>

        <div className='rounded-[14px] border border-[#E3DFD5] bg-white p-[30px] shadow-[0_1px_2px_rgba(19,26,38,.05),0_20px_50px_-30px_rgba(19,26,38,.28)]'>
          <div className='text-[20px] font-semibold tracking-[-0.3px] text-[#131A26]'>
            Set a new password
          </div>
          <div className='mb-6 mt-1.5 text-[13px] leading-[1.6] text-[#5A6070]'>
            This is your first sign-in. Choose a new password before continuing.
          </div>
          <form onSubmit={submit} className='flex flex-col gap-4'>
            <div>
              <label
                htmlFor='current'
                className='mb-1.5 block text-[12.5px] font-semibold tracking-[0.1px] text-[#2C3444]'
              >
                Current password
              </label>
              <input
                id='current'
                type='password'
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete='current-password'
                required
                className='w-full rounded-[9px] border border-[#D3CDBF] bg-white px-[13px] py-[11px] text-[14px] text-[#131A26] outline-none focus:border-[#131A26]'
              />
            </div>
            <div>
              <label
                htmlFor='next'
                className='mb-1.5 block text-[12.5px] font-semibold tracking-[0.1px] text-[#2C3444]'
              >
                New password
              </label>
              <input
                id='next'
                type='password'
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete='new-password'
                required
                className='w-full rounded-[9px] border border-[#D3CDBF] bg-white px-[13px] py-[11px] text-[14px] text-[#131A26] outline-none focus:border-[#131A26]'
              />
              <div className='mt-1.5 text-[11.5px] leading-[1.5] text-[#8A9099]'>
                At least 8 characters. Avoid common or previously breached
                passwords.
              </div>
            </div>
            <div>
              <label
                htmlFor='confirm'
                className='mb-1.5 block text-[12.5px] font-semibold tracking-[0.1px] text-[#2C3444]'
              >
                Confirm new password
              </label>
              <input
                id='confirm'
                type='password'
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete='new-password'
                required
                className='w-full rounded-[9px] border border-[#D3CDBF] bg-white px-[13px] py-[11px] text-[14px] text-[#131A26] outline-none focus:border-[#131A26]'
              />
            </div>
            {error && <p className='text-[13px] text-[#A93226]'>{error}</p>}
            <button
              type='submit'
              disabled={submitting}
              className='mt-0.5 flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#131A26] py-3 text-[14px] font-semibold text-white hover:bg-[#243247] disabled:opacity-60'
            >
              {submitting && <Loader2 className='h-4 w-4 animate-spin' />}
              Change password &amp; continue
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
