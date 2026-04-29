import type { FaceProfile, FaceSignature, FacialDetectionData } from '@/lib/facial-detection'

const FACE_HASH_LENGTH = 256
const FACE_SAMPLE_COUNT = 256
const FACE_COLOR_SAMPLE_COUNT = 48

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumberArray(value: unknown, length: number, min: number, max: number) {
  return Array.isArray(value) &&
    value.length === length &&
    value.every(sample => typeof sample === 'number' && sample >= min && sample <= max)
}

function isFaceSignature(value: unknown): value is FaceSignature {
  if (!isRecord(value)) return false
  if (value.version !== 'face-fingerprint-v2') return false
  if (typeof value.hash !== 'string' || value.hash.length !== FACE_HASH_LENGTH) return false
  if (!isNumberArray(value.samples, FACE_SAMPLE_COUNT, 0, 255)) return false
  if (!isNumberArray(value.gradientSamples, FACE_SAMPLE_COUNT, 0, 255)) return false
  if (!isNumberArray(value.colorSamples, FACE_COLOR_SAMPLE_COUNT, 0, 255)) return false
  if (typeof value.brightness !== 'number') return false
  if (typeof value.contrast !== 'number' || value.contrast < 4) return false

  return true
}

function isFaceProfile(value: unknown): value is FaceProfile {
  if (!isRecord(value)) return false
  if (value.version !== 'multi-sample-v1') return false
  if (!isFaceSignature(value.aggregate)) return false
  if (!Array.isArray(value.signatures) || value.signatures.length < 5) return false

  return value.signatures.every(isFaceSignature)
}

export function isValidFacialData(value: unknown): value is FacialDetectionData {
  if (!isRecord(value)) return false
  if (value.detected !== true) return false
  if (typeof value.confidence !== 'number' || value.confidence < 0.85) return false
  if (!isRecord(value.livenessCheck)) return false
  if (!isFaceProfile(value.faceProfile)) return false

  const riskScore = value.livenessCheck.riskScore
  return typeof riskScore === 'number' && riskScore <= 35
}

function hammingSimilarity(left: string, right: string) {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0

  let matches = 0
  for (let index = 0; index < length; index++) {
    if (left[index] === right[index]) matches++
  }

  return (matches / length) * 100
}

function pearsonSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0

  let leftMean = 0
  let rightMean = 0

  for (let index = 0; index < length; index++) {
    leftMean += left[index]
    rightMean += right[index]
  }

  leftMean /= length
  rightMean /= length

  let numerator = 0
  let leftMagnitude = 0
  let rightMagnitude = 0

  for (let index = 0; index < length; index++) {
    const leftValue = left[index] - leftMean
    const rightValue = right[index] - rightMean
    numerator += leftValue * rightValue
    leftMagnitude += leftValue * leftValue
    rightMagnitude += rightValue * rightValue
  }

  if (!leftMagnitude || !rightMagnitude) return 0
  return ((numerator / Math.sqrt(leftMagnitude * rightMagnitude)) + 1) * 50
}

function absoluteSimilarity(left: number[], right: number[], tolerance: number) {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0

  let difference = 0
  for (let index = 0; index < length; index++) {
    difference += Math.abs(left[index] - right[index])
  }

  return Math.max(0, 100 - (difference / length) * (100 / tolerance))
}

function compareSignatures(enrolledSignature: FaceSignature, currentSignature: FaceSignature) {
  const hashScore = hammingSimilarity(enrolledSignature.hash, currentSignature.hash)
  const textureScore = pearsonSimilarity(enrolledSignature.samples, currentSignature.samples)
  const gradientScore = pearsonSimilarity(enrolledSignature.gradientSamples, currentSignature.gradientSamples)
  const colorScore = absoluteSimilarity(enrolledSignature.colorSamples, currentSignature.colorSamples, 55)
  const brightnessDelta = Math.abs(enrolledSignature.brightness - currentSignature.brightness)
  const contrastDelta = Math.abs(enrolledSignature.contrast - currentSignature.contrast)
  const brightnessScore = Math.max(0, 100 - brightnessDelta * 1.8)
  const contrastScore = Math.max(0, 100 - contrastDelta * 2.2)
  const score = Math.round(
    hashScore * 0.22 +
    textureScore * 0.32 +
    gradientScore * 0.26 +
    colorScore * 0.12 +
    brightnessScore * 0.04 +
    contrastScore * 0.04
  )

  return {
    score,
    hashScore,
    textureScore,
    gradientScore,
    colorScore,
    brightnessDelta,
    contrastDelta,
  }
}

function getSignatures(data: FacialDetectionData): FaceSignature[] {
  if (data.faceProfile && isFaceProfile(data.faceProfile)) {
    return [data.faceProfile.aggregate, ...data.faceProfile.signatures]
  }

  return []
}

function median(values: number[]) {
  if (!values.length) return 0

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function compareFacialData(enrolled: FacialDetectionData, current: FacialDetectionData) {
  if (!isValidFacialData(enrolled) || !isValidFacialData(current)) {
    return { matched: false, score: 0 }
  }

  const enrolledSignatures = getSignatures(enrolled)
  const currentSignatures = getSignatures(current)

  if (enrolledSignatures.length < 6 || currentSignatures.length < 6) {
    return { matched: false, score: 0 }
  }

  const aggregate = compareSignatures(enrolledSignatures[0], currentSignatures[0])
  const pairScores = enrolledSignatures.slice(1).map((enrolledSignature) => {
    const best = currentSignatures.slice(1).reduce((bestScore, currentSignature) => {
      return Math.max(bestScore, compareSignatures(enrolledSignature, currentSignature).score)
    }, 0)

    return best
  })

  const topScores = [...pairScores].sort((left, right) => right - left).slice(0, 5)
  const topAverage = topScores.reduce((sum, value) => sum + value, 0) / Math.max(topScores.length, 1)
  const medianScore = median(pairScores)
  const score = Math.round(aggregate.score * 0.55 + topAverage * 0.3 + medianScore * 0.15)

  return {
    matched:
      score >= 88 &&
      aggregate.score >= 88 &&
      topAverage >= 84 &&
      medianScore >= 78 &&
      aggregate.hashScore >= 84 &&
      aggregate.textureScore >= 84 &&
      aggregate.gradientScore >= 82 &&
      aggregate.colorScore >= 50 &&
      aggregate.brightnessDelta <= 45 &&
      aggregate.contrastDelta <= 35,
    score,
  }
}
