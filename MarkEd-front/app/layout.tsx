import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { AppSidebar } from '@/components/sidebar/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/src/contexts/user-context'
import WarningBanner from '@/components/warning-banner'
import { AssignmentProvider } from '@/src/contexts/assignment-context'
import { CourseProvider } from '@/src/contexts/course-context'
// import Script from 'next/script'


// https://marked-bucket.s3.amazonaws.com/submission/b730a164-484e-4593-b946-c1139a39aa7c.pdf

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'MarkEd',
  description: 'Unified assessment platform: group marking, peer feedback and self-assessment',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      {/* <head>
        <Script
          src='https://unpkg.com/react-scan/dist/auto.global.js'
          crossOrigin='anonymous'
          strategy='beforeInteractive'
        />
      </head> */}

      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-neutral-100 antialiased`}
      >
        <div className='visible absolute left-1/2 top-1/2 w-fit -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white p-4 shadow-md md:invisible'>
          <h1 className='text-xl font-bold'>Oops!</h1>
          <p className='text-md'>
            MarkEd is still in development, please use a wider screen size!
          </p>
        </div>
        <UserProvider>
          <CourseProvider>
            <AssignmentProvider>
              <SidebarProvider className='invisible md:visible'>
                <AppSidebar />
                <WarningBanner />
                <div className='m-auto w-full'>{children}</div>
                <Toaster />
              </SidebarProvider>
            </AssignmentProvider>
          </CourseProvider>
        </UserProvider>
      </body>
    </html>
  )
}
