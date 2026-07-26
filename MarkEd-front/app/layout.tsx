import type { Metadata } from 'next'
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
// react-pdf text/annotation layer styles — hoisted to the global bundle so the
// text layer is always styled (enables text selection) regardless of when the
// lazily-loaded PDF viewer chunk mounts.
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { AppShell } from '@/components/app-shell'

// Prototype typography: Instrument Sans for UI, JetBrains Mono for codes/IDs.
// next/font self-hosts these at build time, so there is no runtime request to
// Google — same look as the prototype, no external dependency at runtime.
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
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
        className={`${instrumentSans.variable} ${jetbrainsMono.variable} bg-paper font-sans text-ink antialiased`}
      >
        <div className='visible absolute left-1/2 top-1/2 w-fit -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white p-4 shadow-md md:invisible'>
          <h1 className='text-xl font-bold'>Oops!</h1>
          <p className='text-md'>
            MarkEd is still in development, please use a wider screen size!
          </p>
        </div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
