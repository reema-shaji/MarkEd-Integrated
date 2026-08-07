'use client'

/**
 * SPA login page.
 *
 * Auth is bearer-token, so the SPA can run on a different origin from the API
 * (Vercel + Render). This page posts to /api/auth/login, stores the returned
 * token, and enters the app.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DefaultService } from '@/src/api'
import { initializeApi, setToken } from '@/src/api/config'
import { Loader2 } from 'lucide-react'

initializeApi()

export default function LoginPage() {
  const router = useRouter()
  const [userNumber, setUserNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /** The single login path — used by the form and by the demo buttons. */
  const doLogin = async (userNumberValue: string, passwordValue: string) => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await DefaultService.apiLogin({
        userNumber: userNumberValue.trim(),
        password: passwordValue,
      })
      setToken(response.token)
      router.replace(
        response.must_change_password ? '/change-password' : '/assignments'
      )
    } catch (err) {
      const status = (err as { status?: number })?.status
      setError(
        status === 401
          ? 'Incorrect user number or password.'
          : status === 403
            ? 'This account is not active. Please contact your tutor.'
            : 'Could not sign in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin(userNumber, password)
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-[#F5F3EF] p-8'>
      <div className='w-full max-w-[396px]'>
        <div className='mb-6 text-center'>
          <div className='text-[26px] font-bold tracking-[-0.6px] text-[#131A26]'>
            Mark<span className='text-[#B4832F]'>Ed</span>
          </div>
        </div>

        <div className='rounded-[14px] border border-[#E3DFD5] bg-white p-[30px] shadow-[0_1px_2px_rgba(19,26,38,.05),0_20px_50px_-30px_rgba(19,26,38,.28)]'>
          <div className='mb-[22px] text-[19px] font-semibold tracking-[-0.3px] text-[#131A26]'>
            Sign in
          </div>
          <form onSubmit={submit} className='flex flex-col gap-4'>
            <div>
              <label
                htmlFor='userNumber'
                className='mb-1.5 block text-[12.5px] font-semibold tracking-[0.1px] text-[#2C3444]'
              >
                User number
              </label>
              <input
                id='userNumber'
                value={userNumber}
                onChange={(e) => setUserNumber(e.target.value)}
                placeholder='e.g. B293734'
                autoComplete='username'
                required
                className='w-full rounded-[9px] border border-[#D3CDBF] bg-white px-[13px] py-[11px] text-[14px] text-[#131A26] outline-none focus:border-[#131A26]'
              />
            </div>
            <div>
              <div className='mb-1.5 flex items-baseline justify-between'>
                <span className='text-[12.5px] font-semibold tracking-[0.1px] text-[#2C3444]'>
                  Password
                </span>
                <a href='#' className='text-[12px] text-[#5A6070] hover:text-[#131A26]'>
                  Forgot?
                </a>
              </div>
              <input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Enter your password'
                autoComplete='current-password'
                required
                className='w-full rounded-[9px] border border-[#D3CDBF] bg-white px-[13px] py-[11px] text-[14px] text-[#131A26] outline-none focus:border-[#131A26]'
              />
            </div>
            {error && <p className='text-[13px] text-[#A93226]'>{error}</p>}
            <button
              type='submit'
              disabled={submitting || !userNumber || !password}
              className='mt-0.5 flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#131A26] py-3 text-[14px] font-semibold text-white hover:bg-[#243247] disabled:opacity-60'
            >
              {submitting && <Loader2 className='h-4 w-4 animate-spin' />}
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
