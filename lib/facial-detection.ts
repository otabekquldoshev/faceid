// Facial detection and liveness utilities

export interface FaceSignature {
  version: 'face-fingerprint-v2';
  hash: string;
  samples: number[];
  colorSamples: number[];
  gradientSamples: number[];
  brightness: number;
  contrast: number;
  capturedAt: string;
}

export interface FaceProfile {
  version: 'multi-sample-v1';
  aggregate: FaceSignature;
  signatures: FaceSignature[];
  capturedAt: string;
}

export interface FacialDetectionData {
  detected: boolean;
  confidence: number;
  position: { x: number; y: number; width: number; height: number } | null;
  faceSignature?: FaceSignature;
  faceProfile?: FaceProfile;
  expressions: {
    neutral: number;
    happy: number;
    surprised: number;
    angry: number;
  };
  livenessCheck: {
    eyesBlinked: boolean;
    headRotation: number;
    faceStable: boolean;
    riskScore: number;
  };
}

class FacialDetectionTracker {
  private previousDetections: FacialDetectionData[] = [];
  private eyeBlinkCount: number = 0;
  private eyeOpenHistory: boolean[] = [];
  private facePositionHistory: { x: number; y: number }[] = [];

  /**
   * Generate simulated facial detection data
   * In a real implementation, this would use face-api.js
   */
  generateDetectionData(): FacialDetectionData {
    const detected = Math.random() > 0.1; // 90% detection rate

    if (!detected) {
      return {
        detected: false,
        confidence: 0,
        position: null,
        expressions: { neutral: 0, happy: 0, surprised: 0, angry: 0 },
        livenessCheck: {
          eyesBlinked: false,
          headRotation: 0,
          faceStable: false,
          riskScore: 100,
        },
      };
    }

    // Simulate face position (center screen with some movement)
    const baseX = 320 - 100 + Math.random() * 200;
    const baseY = 240 - 80 + Math.random() * 160;
    const faceWidth = 200 + Math.random() * 40;
    const faceHeight = 250 + Math.random() * 40;

    this.facePositionHistory.push({ x: baseX, y: baseY });
    if (this.facePositionHistory.length > 30) {
      this.facePositionHistory.shift();
    }

    // Calculate face stability based on position variance
    let faceStable = true;
    let positionVariance = 0;
    if (this.facePositionHistory.length > 5) {
      const recent = this.facePositionHistory.slice(-5);
      const avgX = recent.reduce((sum, p) => sum + p.x, 0) / recent.length;
      const avgY = recent.reduce((sum, p) => sum + p.y, 0) / recent.length;
      positionVariance =
        recent.reduce(
          (sum, p) =>
            sum +
            Math.sqrt(Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2)),
          0
        ) / recent.length;
      faceStable = positionVariance < 30;
    }

    // Simulate eye blinks (every 5-10 detections)
    const eyeOpen = Math.random() > 0.15;
    this.eyeOpenHistory.push(eyeOpen);
    if (this.eyeOpenHistory.length > 30) {
      this.eyeOpenHistory.shift();
    }

    // Detect blinks (transition from closed to open)
    if (
      this.eyeOpenHistory.length > 1 &&
      !this.eyeOpenHistory[this.eyeOpenHistory.length - 2] &&
      eyeOpen
    ) {
      this.eyeBlinkCount++;
    }

    // Simulate head rotation (pitch and yaw)
    const headRotation = Math.sin(Date.now() / 3000) * 15; // -15 to 15 degrees

    let expressions = {
      neutral: 0.7 + Math.random() * 0.3,
      happy: Math.random() * 0.3,
      surprised: Math.random() * 0.1,
      angry: Math.random() * 0.05,
    };

    // Normalize expressions to sum to 1
    const sum = expressions.neutral + expressions.happy + expressions.surprised + expressions.angry;
    expressions = {
      neutral: expressions.neutral / sum,
      happy: expressions.happy / sum,
      surprised: expressions.surprised / sum,
      angry: expressions.angry / sum,
    };

    // Calculate liveness risk score
    // Lower score = more likely to be real person
    let livenessRiskScore = 0;
    if (!faceStable) livenessRiskScore += 20;
    if (!eyeOpen) livenessRiskScore += 15;
    if (Math.abs(headRotation) > 20) livenessRiskScore += 15;
    if (expressions.happy > 0.5) livenessRiskScore += 10; // Too happy is suspicious

    // Add some randomness
    livenessRiskScore = Math.max(0, livenessRiskScore + (Math.random() - 0.5) * 10);
    livenessRiskScore = Math.min(100, livenessRiskScore);

    const confidence = 0.85 + Math.random() * 0.15; // 85-100% confidence

    return {
      detected: true,
      confidence,
      position: {
        x: baseX,
        y: baseY,
        width: faceWidth,
        height: faceHeight,
      },
      expressions,
      livenessCheck: {
        eyesBlinked: eyeOpen,
        headRotation,
        faceStable,
        riskScore: Math.round(livenessRiskScore),
      },
    };
  }

  /**
   * Get liveness verification status
   */
  getLivenessStatus(): {
    status: 'pending' | 'checking' | 'verified' | 'failed';
    progress: number;
    message: string;
  } {
    const blinkRequirement = 2;
    const rotationRequirement = 15;
    const stabilityRequirement = 0.8;

    const recentDetections = this.previousDetections.slice(-30);
    if (recentDetections.length === 0) {
      return { status: 'pending', progress: 0, message: 'Initializing...' };
    }

    // Check for blinks
    const hasBlinks = this.eyeBlinkCount >= blinkRequirement;
    const blinkProgress = Math.min(this.eyeBlinkCount / blinkRequirement, 1) * 25;

    // Check for head rotation
    const maxRotation = Math.max(
      ...recentDetections.map(d => Math.abs(d.livenessCheck.headRotation))
    );
    const hasRotation = maxRotation >= rotationRequirement;
    const rotationProgress = Math.min(maxRotation / rotationRequirement, 1) * 25;

    // Check for stability
    const stableCount = recentDetections.filter(
      d => d.livenessCheck.faceStable
    ).length;
    const stability = stableCount / recentDetections.length;
    const hasStability = stability >= stabilityRequirement;
    const stabilityProgress = Math.min(stability / stabilityRequirement, 1) * 25;

    // Check for consistent detection
    const detectionCount = recentDetections.filter(d => d.detected).length;
    const hasConsistentDetection = detectionCount / recentDetections.length > 0.9;
    const consistencyProgress =
      Math.min(detectionCount / (recentDetections.length * 0.9), 1) * 25;

    const totalProgress =
      blinkProgress + rotationProgress + stabilityProgress + consistencyProgress;

    if (hasBlinks && hasRotation && hasStability && hasConsistentDetection) {
      return {
        status: 'verified',
        progress: 100,
        message: 'Liveness verified! Authenticity confirmed.',
      };
    }

    if (totalProgress > 50) {
      return {
        status: 'checking',
        progress: Math.round(totalProgress),
        message: 'Checking liveness... Keep looking at camera.',
      };
    }

    return {
      status: 'pending',
      progress: Math.round(totalProgress),
      message: 'Initialize by looking at camera and moving head slightly.',
    };
  }

  /**
   * Add detection result for tracking
   */
  addDetection(data: FacialDetectionData) {
    this.previousDetections.push(data);
    if (this.previousDetections.length > 100) {
      this.previousDetections.shift();
    }
  }

  /**
   * Reset tracker
   */
  reset() {
    this.previousDetections = [];
    this.eyeBlinkCount = 0;
    this.eyeOpenHistory = [];
    this.facePositionHistory = [];
  }

  /**
   * Get blink count
   */
  getBlinkCount(): number {
    return this.eyeBlinkCount;
  }
}

export const facialDetectionTracker = new FacialDetectionTracker();
