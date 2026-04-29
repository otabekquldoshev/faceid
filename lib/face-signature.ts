import type { FaceProfile, FaceSignature, FacialDetectionData } from '@/lib/facial-detection'

const GRID_SIZE = 16
const SAMPLE_COUNT = GRID_SIZE * GRID_SIZE
const COLOR_GRID_SIZE = 4
const COLOR_SAMPLE_COUNT = COLOR_GRID_SIZE * COLOR_GRID_SIZE * 3

type SignatureSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getSourceSize(source: SignatureSource) {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth || source.clientWidth || 640,
      height: source.videoHeight || source.clientHeight || 480,
    }
  }

  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width || 640,
      height: source.naturalHeight || source.height || 480,
    }
  }

  return {
    width: source.width || 640,
    height: source.height || 480,
  }
}

function getCrop(source: SignatureSource, position: FacialDetectionData['position']) {
  const { width, height } = getSourceSize(source)

  if (!position) {
    const cropWidth = Math.min(width, height) * 0.68
    const cropHeight = cropWidth * 1.18
    return {
      x: (width - cropWidth) / 2,
      y: (height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    }
  }

  const padding = Math.max(position.width, position.height) * 0.16
  const x = clamp(position.x - padding, 0, width - 1)
  const y = clamp(position.y - padding, 0, height - 1)
  const cropWidth = clamp(position.width + padding * 2, 1, width - x)
  const cropHeight = clamp(position.height + padding * 2, 1, height - y)

  return { x, y, width: cropWidth, height: cropHeight }
}

function luminance(red: number, green: number, blue: number) {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114)
}

function getPixel(data: Uint8ClampedArray, x: number, y: number, width: number) {
  const offset = (y * width + x) * 4
  return {
    red: data[offset],
    green: data[offset + 1],
    blue: data[offset + 2],
  }
}

function createSignatureFromSource(
  source: SignatureSource,
  position: FacialDetectionData['position']
): FaceSignature | null {
  const { width, height } = getSourceSize(source)
  if (!width || !height) return null

  const crop = getCrop(source, position)
  const canvas = document.createElement('canvas')
  canvas.width = GRID_SIZE
  canvas.height = GRID_SIZE

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, GRID_SIZE, GRID_SIZE)

  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE)
  const samples: number[] = []
  const gradientSamples: number[] = []

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const { red, green, blue } = getPixel(data, x, y, GRID_SIZE)
      samples.push(luminance(red, green, blue))
    }
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const left = samples[y * GRID_SIZE + Math.max(0, x - 1)]
      const right = samples[y * GRID_SIZE + Math.min(GRID_SIZE - 1, x + 1)]
      const up = samples[Math.max(0, y - 1) * GRID_SIZE + x]
      const down = samples[Math.min(GRID_SIZE - 1, y + 1) * GRID_SIZE + x]
      gradientSamples.push(clamp(Math.round(Math.hypot(right - left, down - up)), 0, 255))
    }
  }

  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = COLOR_GRID_SIZE
  colorCanvas.height = COLOR_GRID_SIZE
  const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true })
  if (!colorCtx) return null

  colorCtx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, COLOR_GRID_SIZE, COLOR_GRID_SIZE)
  const colorData = colorCtx.getImageData(0, 0, COLOR_GRID_SIZE, COLOR_GRID_SIZE).data
  const colorSamples: number[] = []

  for (let index = 0; index < COLOR_SAMPLE_COUNT / 3; index++) {
    const offset = index * 4
    colorSamples.push(colorData[offset], colorData[offset + 1], colorData[offset + 2])
  }

  const brightness = samples.reduce((sum, value) => sum + value, 0) / samples.length
  const variance =
    samples.reduce((sum, value) => sum + Math.pow(value - brightness, 2), 0) / samples.length
  const contrast = Math.sqrt(variance)
  const hash = samples.map(value => (value >= brightness ? '1' : '0')).join('')

  return {
    version: 'face-fingerprint-v2',
    hash,
    samples,
    colorSamples,
    gradientSamples,
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    capturedAt: new Date().toISOString(),
  }
}

export function createFaceSignature(
  video: HTMLVideoElement,
  position: FacialDetectionData['position']
): FaceSignature | null {
  if (!video.videoWidth || !video.videoHeight) return null
  return createSignatureFromSource(video, position)
}

export function createFaceSignatureFromImage(image: HTMLImageElement): FaceSignature | null {
  return createSignatureFromSource(image, null)
}

export function buildFaceProfile(signatures: FaceSignature[]): FaceProfile | null {
  const usable = signatures
    .filter(signature => {
      return (
        signature.version === 'face-fingerprint-v2' &&
        signature.samples.length === SAMPLE_COUNT &&
        signature.gradientSamples.length === SAMPLE_COUNT &&
        signature.colorSamples.length === COLOR_SAMPLE_COUNT &&
        signature.contrast >= 4
      )
    })
    .slice(-18)

  if (usable.length < 5) return null

  const samples = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const total = usable.reduce((sum, signature) => sum + signature.samples[index], 0)
    return Math.round(total / usable.length)
  })
  const gradientSamples = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const total = usable.reduce((sum, signature) => sum + signature.gradientSamples[index], 0)
    return Math.round(total / usable.length)
  })
  const colorSamples = Array.from({ length: COLOR_SAMPLE_COUNT }, (_, index) => {
    const total = usable.reduce((sum, signature) => sum + signature.colorSamples[index], 0)
    return Math.round(total / usable.length)
  })
  const brightness = samples.reduce((sum, value) => sum + value, 0) / samples.length
  const variance =
    samples.reduce((sum, value) => sum + Math.pow(value - brightness, 2), 0) / samples.length
  const contrast = Math.sqrt(variance)
  const hash = samples.map(value => (value >= brightness ? '1' : '0')).join('')

  const aggregate: FaceSignature = {
    version: 'face-fingerprint-v2',
    hash,
    samples,
    colorSamples,
    gradientSamples,
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    capturedAt: new Date().toISOString(),
  }

  return {
    version: 'multi-sample-v1',
    aggregate,
    signatures: usable,
    capturedAt: new Date().toISOString(),
  }
}

export function withFaceProfile(data: FacialDetectionData, signatures: FaceSignature[]) {
  const profile = buildFaceProfile(signatures)
  if (!profile) return data

  return {
    ...data,
    faceSignature: profile.aggregate,
    faceProfile: profile,
  }
}
