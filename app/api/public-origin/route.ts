import { NextRequest, NextResponse } from 'next/server'
import { networkInterfaces } from 'os'

type NgrokTunnel = {
  public_url?: string
  proto?: string
}

const isLocalOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
  } catch {
    return false
  }
}

const isHttpsOrigin = (origin: string) => {
  try {
    return new URL(origin).protocol === 'https:'
  } catch {
    return false
  }
}

const getLanOrigin = (origin: string) => {
  try {
    const url = new URL(origin)
    const port = url.port ? `:${url.port}` : ''
    const interfaces = networkInterfaces()

    for (const addresses of Object.values(interfaces)) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal) {
          return `${url.protocol}//${address.address}${port}`
        }
      }
    }
  } catch {
    return null
  }

  return null
}

async function getNgrokOrigin() {
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels', {
      cache: 'no-store',
    })

    if (!response.ok) return null

    const data = await response.json()
    const tunnel = (data.tunnels as NgrokTunnel[] | undefined)?.find(item => {
      return item.proto === 'https' && item.public_url?.startsWith('https://')
    })

    return tunnel?.public_url?.replace(/\/$/, '') || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)?.replace(/\/$/, '')
  const requestOrigin = request.nextUrl.origin.replace(/\/$/, '')
  const ngrokOrigin = await getNgrokOrigin()

  if (configuredOrigin && !isLocalOrigin(configuredOrigin) && isHttpsOrigin(configuredOrigin)) {
    return NextResponse.json({ origin: configuredOrigin })
  }

  if (ngrokOrigin) {
    return NextResponse.json({ origin: ngrokOrigin })
  }

  if (!isLocalOrigin(requestOrigin) && isHttpsOrigin(requestOrigin)) {
    return NextResponse.json({ origin: requestOrigin })
  }

  if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
    return NextResponse.json({ origin: configuredOrigin })
  }

  if (!isLocalOrigin(requestOrigin)) {
    return NextResponse.json({ origin: requestOrigin })
  }

  const lanOrigin = getLanOrigin(requestOrigin)
  if (lanOrigin) {
    return NextResponse.json({ origin: lanOrigin })
  }

  return NextResponse.json({ origin: configuredOrigin || requestOrigin })
}
