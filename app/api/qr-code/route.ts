import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get('data')

  if (!data) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  const image = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: {
      dark: '#0d3b66',
      light: '#ffffff',
    },
  })

  return NextResponse.json({ image })
}
