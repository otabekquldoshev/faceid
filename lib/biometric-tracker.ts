// Behavioral biometric tracking utilities

export interface KeystrokeData {
  intervals: number[];
  averageInterval: number;
  variance: number;
  riskScore: number;
}

export interface MouseMovementData {
  velocity: number;
  acceleration: number;
  direction: number;
  riskScore: number;
}

export interface ScrollData {
  velocity: number;
  pauseTime: number;
  direction: number;
  riskScore: number;
}

class BiometricTracker {
  private lastKeystrokeTime: number = 0;
  private keystrokeIntervals: number[] = [];
  private mouseEvents: { x: number; y: number; time: number }[] = [];
  private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
  private lastScrollTime: number = 0;
  private lastScrollPos: number = 0;

  /**
   * Track keystroke intervals and analyze typing rhythm
   */
  trackKeystroke(): KeystrokeData {
    const now = Date.now();

    if (this.lastKeystrokeTime > 0) {
      const interval = now - this.lastKeystrokeTime;
      this.keystrokeIntervals.push(interval);

      // Keep only last 50 keystrokes
      if (this.keystrokeIntervals.length > 50) {
        this.keystrokeIntervals.shift();
      }
    }

    this.lastKeystrokeTime = now;

    // Calculate statistics
    const avgInterval =
      this.keystrokeIntervals.reduce((a, b) => a + b, 0) /
        this.keystrokeIntervals.length || 0;
    const variance =
      this.keystrokeIntervals.reduce(
        (sum, val) => sum + Math.pow(val - avgInterval, 2),
        0
      ) / this.keystrokeIntervals.length || 0;

    // Risk score based on consistency (lower variance = more consistent = lower risk)
    const normalizedVariance = Math.min(variance / 10000, 1);
    const riskScore = normalizedVariance * 100;

    return {
      intervals: this.keystrokeIntervals.slice(-10),
      averageInterval: Math.round(avgInterval),
      variance: Math.round(variance),
      riskScore: Math.round(riskScore),
    };
  }

  /**
   * Track mouse movement patterns
   */
  trackMouseMovement(x: number, y: number): MouseMovementData {
    const now = Date.now();
    this.mouseEvents.push({ x, y, time: now });

    // Keep only last 20 events
    if (this.mouseEvents.length > 20) {
      this.mouseEvents.shift();
    }

    // Calculate velocity and acceleration
    let velocity = 0;
    let acceleration = 0;

    if (this.mouseEvents.length >= 2) {
      const current = this.mouseEvents[this.mouseEvents.length - 1];
      const previous = this.mouseEvents[this.mouseEvents.length - 2];

      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const dt = Math.max(current.time - previous.time, 1) / 1000; // Convert to seconds

      velocity = Math.sqrt(dx * dx + dy * dy) / dt;

      // Calculate acceleration
      if (this.mouseEvents.length >= 3) {
        const prevPrev = this.mouseEvents[this.mouseEvents.length - 3];
        const prevDx = previous.x - prevPrev.x;
        const prevDy = previous.y - prevPrev.y;
        const prevDt = Math.max(previous.time - prevPrev.time, 1) / 1000;

        const prevVelocity = Math.sqrt(prevDx * prevDx + prevDy * prevDy) / prevDt;
        acceleration = (velocity - prevVelocity) / dt;
      }
    }

    // Calculate direction (0-360 degrees)
    const dx = x - this.lastMousePos.x;
    const dy = y - this.lastMousePos.y;
    const direction = (Math.atan2(dy, dx) * 180) / Math.PI;

    this.lastMousePos = { x, y };

    // Risk score based on erratic movement (high acceleration = risky)
    const normalizedAcceleration = Math.min(Math.abs(acceleration) / 1000, 1);
    const riskScore = normalizedAcceleration * 100;

    return {
      velocity: Math.round(velocity),
      acceleration: Math.round(acceleration),
      direction: Math.round((direction + 360) % 360),
      riskScore: Math.round(riskScore),
    };
  }

  /**
   * Track scroll patterns
   */
  trackScroll(scrollPos: number): ScrollData {
    const now = Date.now();

    let velocity = 0;
    let pauseTime = 0;

    if (this.lastScrollTime > 0) {
      const dt = (now - this.lastScrollTime) / 1000;
      const dy = scrollPos - this.lastScrollPos;
      velocity = dy / dt;
      pauseTime = dt > 0.5 ? dt * 1000 : 0;
    }

    this.lastScrollTime = now;
    this.lastScrollPos = scrollPos;

    // Calculate direction (1 = down, -1 = up, 0 = no movement)
    const direction = velocity > 50 ? 1 : velocity < -50 ? -1 : 0;

    // Risk score based on pause patterns (too long pauses = risky)
    const normalizedPause = Math.min(pauseTime / 5000, 1);
    const riskScore = normalizedPause * 100;

    return {
      velocity: Math.round(velocity),
      pauseTime: Math.round(pauseTime),
      direction,
      riskScore: Math.round(riskScore),
    };
  }

  /**
   * Reset tracking data
   */
  reset() {
    this.lastKeystrokeTime = 0;
    this.keystrokeIntervals = [];
    this.mouseEvents = [];
    this.lastScrollTime = 0;
    this.lastScrollPos = 0;
  }

  /**
   * Calculate overall behavioral risk score
   */
  calculateOverallRiskScore(
    keystrokeData: KeystrokeData,
    mouseData: MouseMovementData,
    scrollData: ScrollData
  ): number {
    // Weighted average of risk scores
    const weights = {
      keystroke: 0.4,
      mouse: 0.35,
      scroll: 0.25,
    };

    const overall =
      keystrokeData.riskScore * weights.keystroke +
      mouseData.riskScore * weights.mouse +
      scrollData.riskScore * weights.scroll;

    return Math.round(overall);
  }
}

export const biometricTracker = new BiometricTracker();
