import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/p',
  trailingSlash: true,
  webpack: (config) => {
    config.resolve.alias.canvas = false
    config.resolve.alias.encoding = false
    return config
  },
}

export default nextConfig
