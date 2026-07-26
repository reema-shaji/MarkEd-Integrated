import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // basePath is applied only when NEXT_PUBLIC_BASE_PATH is provided (the local
  // nginx-proxied stack sets it to '/p'). On Vercel it is unset, so the app
  // serves from the domain root — otherwise '/' 404s.
  ...(process.env.NEXT_PUBLIC_BASE_PATH
    ? { basePath: process.env.NEXT_PUBLIC_BASE_PATH }
    : {}),
  trailingSlash: true,
  // react-pdf / pdfjs-dist ship ESM (.mjs) that Next must transpile, otherwise
  // pdf.mjs fails to initialise ("Object.defineProperty called on non-object").
  transpilePackages: ['react-pdf', 'pdfjs-dist'],
  webpack: (config) => {
    config.resolve.alias.canvas = false
    config.resolve.alias.encoding = false
    return config
  },
}

export default nextConfig
