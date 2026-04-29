import { networkInterfaces } from 'node:os'

const getAllowedDevOrigins = () => {
  const lanOrigins = Object.values(networkInterfaces())
    .flatMap(addresses => addresses || [])
    .filter(address => address.family === 'IPv4' && !address.internal)
    .map(address => address.address)

  return ['*.ngrok-free.app', ...lanOrigins]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/auth/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
