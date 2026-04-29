'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Mouse, Scroll } from 'lucide-react';
import {
  KeystrokeData,
  MouseMovementData,
  ScrollData,
  biometricTracker,
} from '@/lib/biometric-tracker';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function BehavioralMonitoringPage() {
  const [keystrokeData, setKeystrokeData] = useState<KeystrokeData | null>(null);
  const [mouseData, setMouseData] = useState<MouseMovementData | null>(null);
  const [scrollData, setScrollData] = useState<ScrollData | null>(null);
  const [keystrokeHistory, setKeystrokeHistory] = useState<number[]>([]);
  const [mouseVelocityHistory, setMouseVelocityHistory] = useState<
    { time: number; velocity: number }[]
  >([]);
  const [isTracking] = useState(true);
  const dummyInputRef = useRef<HTMLInputElement>(null);

  // Simulate keystroke tracking
  useEffect(() => {
    if (!isTracking) return;

    const handleKeyDown = () => {
      const data = biometricTracker.trackKeystroke();
      setKeystrokeData(data);
      setKeystrokeHistory((prev) => [...prev.slice(-30), data.averageInterval]);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const data = biometricTracker.trackMouseMovement(e.clientX, e.clientY);
      setMouseData(data);
      setMouseVelocityHistory((prev) => [
        ...prev.slice(-30),
        { time: Date.now(), velocity: data.velocity },
      ]);
    };

    const handleScroll = () => {
      const data = biometricTracker.trackScroll(window.scrollY);
      setScrollData(data);
    };

    // Generate simulated keystroke activity
    const keystrokeInterval = setInterval(() => {
      if (Math.random() > 0.6) {
        const data = biometricTracker.trackKeystroke();
        setKeystrokeData(data);
        setKeystrokeHistory((prev) => [...prev.slice(-30), data.averageInterval]);
      }
    }, 200);

    // Generate simulated mouse activity
    const mouseInterval = setInterval(() => {
      if (Math.random() > 0.5) {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const data = biometricTracker.trackMouseMovement(x, y);
        setMouseData(data);
        setMouseVelocityHistory((prev) => [
          ...prev.slice(-30),
          { time: Date.now(), velocity: data.velocity },
        ]);
      }
    }, 300);

    // Generate simulated scroll activity
    const scrollInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        const data = biometricTracker.trackScroll(window.scrollY);
        setScrollData(data);
      }
    }, 500);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('scroll', handleScroll);
      clearInterval(keystrokeInterval);
      clearInterval(mouseInterval);
      clearInterval(scrollInterval);
    };
  }, [isTracking]);

  const overallRiskScore = useMemo(() => {
    if (!keystrokeData || !mouseData || !scrollData) return 0;
    return biometricTracker.calculateOverallRiskScore(
      keystrokeData,
      mouseData,
      scrollData
    );
  }, [keystrokeData, mouseData, scrollData]);

  const getRiskLevel = (score: number) => {
    if (score < 30) return { label: 'Low', color: 'text-primary' };
    if (score < 60) return { label: 'Medium', color: 'text-secondary' };
    return { label: 'High', color: 'text-destructive' };
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return '#00ff88';
    if (score < 60) return '#ffaa00';
    return '#ff0055';
  };

  const chartData = keystrokeHistory.map((interval, idx) => ({
    index: idx,
    interval,
  }));

  const velocityChartData = mouseVelocityHistory.slice(-20).map((item, idx) => ({
    index: idx,
    velocity: item.velocity,
  }));

  return (
    <div className="p-6 space-y-6 fade-in-up">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-primary glow">
          Behavioral Biometric Monitoring
        </h2>
        <p className="text-muted-foreground">
          Real-time tracking of typing rhythm, mouse patterns, and scroll behavior
        </p>
      </div>

      {/* Overall Risk Score */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-card border-2 border-primary/30 rounded-lg p-6 neon-pulse"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              OVERALL RISK ASSESSMENT
            </h3>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-bold"
                style={{ color: getRiskColor(overallRiskScore) }}
              >
                {overallRiskScore}%
              </span>
              <span
                className={`text-lg font-semibold ${getRiskLevel(overallRiskScore).color}`}
              >
                {getRiskLevel(overallRiskScore).label} Risk
              </span>
            </div>
          </div>

          {/* Risk Gauge */}
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Background arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#2a2f4a"
                strokeWidth="3"
              />

              {/* Risk arc */}
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={getRiskColor(overallRiskScore)}
                strokeWidth="3"
                strokeDasharray={`${(overallRiskScore / 100) * 251} 251`}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 8px ${getRiskColor(overallRiskScore)})`,
                }}
              />

              {/* Text */}
              <text
                x="50"
                y="55"
                textAnchor="middle"
                fontSize="24"
                fontWeight="bold"
                fill="#e0e6ff"
              >
                {overallRiskScore}%
              </text>
            </svg>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Keystroke Analysis */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-1 bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity size={20} className="text-primary" />
            <h3 className="font-semibold text-foreground">Keystroke Analysis</h3>
          </div>

          {keystrokeData && (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Avg Interval</span>
                  <span className="text-accent">
                    {keystrokeData.averageInterval}ms
                  </span>
                </div>
                <div className="w-full bg-muted rounded h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(keystrokeData.averageInterval / 200, 1) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Variance</span>
                  <span className="text-secondary">
                    {keystrokeData.variance}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="text-destructive">
                    {keystrokeData.riskScore}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-destructive"
                    style={{
                      width: `${keystrokeData.riskScore}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <p className="text-muted-foreground italic pt-2">
                {keystrokeData.riskScore < 30
                  ? 'Typing rhythm consistent - Low impersonation risk'
                  : keystrokeData.riskScore < 60
                    ? 'Typing pattern irregular - Possible anomaly'
                    : 'Significant typing deviation - High impersonation risk'}
              </p>
            </div>
          )}
        </motion.div>

        {/* Mouse Movement Analysis */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="lg:col-span-1 bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Mouse size={20} className="text-accent" />
            <h3 className="font-semibold text-foreground">Mouse Movement</h3>
          </div>

          {mouseData && (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Velocity</span>
                  <span className="text-accent">{mouseData.velocity}px/s</span>
                </div>
                <div className="w-full bg-muted rounded h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    style={{
                      width: `${Math.min(mouseData.velocity / 500, 1) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Acceleration</span>
                  <span className="text-secondary">
                    {mouseData.acceleration}px/s²
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Direction</span>
                  <span className="text-primary">{mouseData.direction}°</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="text-destructive">{mouseData.riskScore}%</span>
                </div>
                <div className="w-full bg-muted rounded h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-destructive"
                    style={{
                      width: `${mouseData.riskScore}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Scroll Behavior */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="lg:col-span-1 bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Scroll size={20} className="text-secondary" />
            <h3 className="font-semibold text-foreground">Scroll Behavior</h3>
          </div>

          {scrollData && (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Velocity</span>
                  <span className="text-accent">{scrollData.velocity}px/s</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Pause Time</span>
                  <span className="text-secondary">{scrollData.pauseTime}ms</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Direction</span>
                  <span className="text-primary">
                    {scrollData.direction === 1
                      ? 'Down'
                      : scrollData.direction === -1
                        ? 'Up'
                        : 'None'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="text-destructive">
                    {scrollData.riskScore}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded h-1 overflow-hidden">
                  <motion.div
                    className="h-full bg-destructive"
                    style={{
                      width: `${scrollData.riskScore}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Charts */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Keystroke Interval Chart */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Keystroke Intervals
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
              <XAxis
                dataKey="index"
                stroke="#8890aa"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis stroke="#8890aa" style={{ fontSize: '0.75rem' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f3a',
                  border: '1px solid #2a2f4a',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#e0e6ff' }}
              />
              <Line
                type="monotone"
                dataKey="interval"
                stroke="#00ff88"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mouse Velocity Chart */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">Mouse Velocity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={velocityChartData}>
              <defs>
                <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
              <XAxis
                dataKey="index"
                stroke="#8890aa"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis stroke="#8890aa" style={{ fontSize: '0.75rem' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f3a',
                  border: '1px solid #2a2f4a',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#e0e6ff' }}
              />
              <Area
                type="monotone"
                dataKey="velocity"
                stroke="#00d4ff"
                fillOpacity={1}
                fill="url(#colorVelocity)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Hidden input for keystroke tracking */}
      <input
        ref={dummyInputRef}
        type="text"
        className="absolute opacity-0"
        placeholder="Tracking keystrokes..."
      />
    </div>
  );
}
