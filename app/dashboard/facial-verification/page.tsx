'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { createFaceSignature, withFaceProfile } from '@/lib/face-signature';
import { facialDetectionTracker, type FaceSignature, type FacialDetectionData } from '@/lib/facial-detection';
import { Button } from '@/components/ui/button';

type LivenessStatus = {
  status: 'pending' | 'checking' | 'verified' | 'failed';
  progress: number;
  message: string;
};

function FacialVerificationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get('session');
  const userId = searchParams.get('user');
  const isLoginFlow = Boolean(sessionToken || userId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceSignaturesRef = useRef<FaceSignature[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    'pending' | 'granted' | 'denied'
  >('pending');
  const [detectionData, setDetectionData] = useState<FacialDetectionData | null>(
    null
  );
  const [signatureCount, setSignatureCount] = useState(0);
  const [livenessStatus, setLivenessStatus] = useState<LivenessStatus>({
    status: 'pending',
    progress: 0,
    message: 'Initializing camera...',
  });
  const [blinkCount, setBlinkCount] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Check if user has valid session
  useEffect(() => {
    if (isLoginFlow && (!sessionToken || !userId)) {
      router.push('/auth/login');
    }
  }, [isLoginFlow, sessionToken, userId, router]);

  // Initialize camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsStreaming(true);
          setCameraPermission('granted');
        }
      } catch {
        console.error('Camera access denied');
        setCameraPermission('denied');
      }
    };

    initCamera();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Handle facial verification
  const handleFacialVerification = async () => {
    if (!isStreaming || !detectionData || !sessionToken || !userId) return;
    const profiledData = withFaceProfile(detectionData, faceSignaturesRef.current);

    if (!profiledData.faceProfile) {
      setVerificationError('Face profile is not ready yet. Please keep looking at the camera for a few seconds.');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const response = await fetch('/api/auth/facial-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionToken,
          facialData: profiledData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setVerificationError(data.error || 'Verification failed');
        return;
      }

      setIsVerified(true);
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/facial-verification');
      }, 2000);
    } catch {
      setVerificationError('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Detection loop
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      // Generate simulated detection data
      const data = facialDetectionTracker.generateDetectionData();
      const faceSignature = data.detected && videoRef.current
        ? createFaceSignature(videoRef.current, data.position)
        : null;
      if (faceSignature) {
        faceSignaturesRef.current = [...faceSignaturesRef.current.slice(-23), faceSignature];
        setSignatureCount(faceSignaturesRef.current.length);
      }
      const signedData = faceSignature ? { ...data, faceSignature } : data;
      facialDetectionTracker.addDetection(signedData);
      setDetectionData(signedData);

      // Update liveness status
      const status = facialDetectionTracker.getLivenessStatus();
      setLivenessStatus(status);
      setBlinkCount(facialDetectionTracker.getBlinkCount());

      // Draw on canvas
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;

          // Draw video
          ctx.drawImage(
            videoRef.current,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );

          // Draw face detection box
          if (signedData.detected && signedData.position) {
            const pos = signedData.position;
            const color =
              signedData.livenessCheck.riskScore < 30
                ? '#00ff88'
                : signedData.livenessCheck.riskScore < 60
                  ? '#ffaa00'
                  : '#ff0055';

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);

            // Draw glow effect
            ctx.strokeStyle = color + '40';
            ctx.lineWidth = 8;
            ctx.strokeRect(pos.x - 5, pos.y - 5, pos.width + 10, pos.height + 10);
          }

          // Draw status text
          ctx.fillStyle = '#00ff88';
          ctx.font = 'bold 16px monospace';
          ctx.fillText(
            `Confidence: ${data.confidence ? (data.confidence * 100).toFixed(1) : 0}%`,
            10,
            30
          );
          ctx.fillText(
            `Risk Score: ${signedData.livenessCheck.riskScore}%`,
            10,
            60
          );
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div className="p-6 space-y-6 fade-in-up">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-primary glow">
          Facial Biometric Verification
        </h2>
        <p className="text-muted-foreground">
          Real-time facial recognition with liveness detection
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-lg overflow-hidden border-2 border-primary/50 bg-card neon-pulse aspect-video glow-green scan-effect">
            {cameraPermission === 'granted' ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover hidden"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <Camera className="w-12 h-12 text-primary mx-auto mb-2" />
                      <p className="text-foreground">Initializing camera...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                  <p className="text-foreground">Camera access denied</p>
                  <p className="text-sm text-muted-foreground">
                    Please allow camera access to continue
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Liveness Status */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {livenessStatus.status === 'verified' ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Camera className="w-5 h-5 text-accent" />
                )}
                <span className="font-semibold text-foreground">
                  {livenessStatus.message}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-card border border-border rounded h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-300"
                  style={{ width: `${livenessStatus.progress}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Progress: {livenessStatus.progress}% • Blinks: {blinkCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Face samples: {Math.min(signatureCount, 5)}/5
              </p>
            </div>

            {/* Verification Status */}
            {verificationError && (
              <div className="p-3 bg-destructive/10 border border-destructive/50 rounded flex gap-2">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{verificationError}</p>
              </div>
            )}

            {isVerified && (
              <div className="p-3 bg-primary/10 border border-primary/50 rounded flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">Verification successful! Redirecting...</p>
              </div>
            )}

            {/* Verify Button */}
            {isLoginFlow && !isVerified && (
              <Button
                onClick={handleFacialVerification}
                disabled={isVerifying || livenessStatus.progress < 70 || signatureCount < 5 || isVerified}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground neon-pulse"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : livenessStatus.progress < 70 ? (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Complete Liveness Check ({livenessStatus.progress}%)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Verify Facial Recognition
                  </>
                )}
              </Button>
            )}
            {!isLoginFlow && (
              <div className="p-3 bg-accent/10 border border-accent/30 rounded flex gap-2">
                <Camera className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">Dashboard monitoring mode is active.</p>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Panel */}
        <div className="space-y-4">
          {/* Detection Status */}
          <div className="bg-card border border-primary/50 rounded-lg p-4 neon-pulse glow-green scan-effect">
            <h3 className="text-sm font-semibold text-primary mb-3 glow">Detection</h3>
            {detectionData && (
              <div className="space-y-2 text-xs text-foreground">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={
                      detectionData.detected ? 'text-primary' : 'text-destructive'
                    }
                  >
                    {detectionData.detected ? 'Detected' : 'Not Detected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="text-accent">
                    {(detectionData.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Risk Score:</span>
                  <span className="text-secondary">
                    {detectionData.livenessCheck.riskScore}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Expressions */}
          <div className="bg-card border border-accent/30 rounded-lg p-4 neon-pulse-cyan">
            <h3 className="text-sm font-semibold text-accent mb-3 glow">
              Expressions
            </h3>
            {detectionData && (
              <div className="space-y-2">
                {Object.entries(detectionData.expressions).map(([name, value]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">
                        {name}
                      </span>
                      <span className="text-accent">
                        {(value * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-card border border-border rounded h-1 overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Liveness Checks */}
          <div className="bg-card border border-secondary/30 rounded-lg p-4 neon-pulse-magenta">
            <h3 className="text-sm font-semibold text-secondary mb-3 glow">
              Liveness Checks
            </h3>
            {detectionData && (
              <div className="space-y-2 text-xs text-foreground">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      detectionData.livenessCheck.eyesBlinked
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                  <span className="text-muted-foreground">Eyes Blinked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      Math.abs(detectionData.livenessCheck.headRotation) > 10
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                  <span className="text-muted-foreground">Head Movement</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      detectionData.livenessCheck.faceStable
                        ? 'bg-primary'
                        : 'bg-muted'
                    }`}
                  />
                  <span className="text-muted-foreground">Face Stable</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FacialVerificationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading facial verification...</div>}>
      <FacialVerificationClient />
    </Suspense>
  )
}
