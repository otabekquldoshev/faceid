'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

type RiskTrendPoint = {
  time: number;
  risk: number;
  facial: number;
  behavioral: number;
};

const initialRiskTrend: RiskTrendPoint[] = Array.from({ length: 20 }, (_, i) => ({
  time: i,
  risk: 20 + ((i * 7) % 40),
  facial: 15 + ((i * 5) % 35),
  behavioral: 20 + ((i * 9) % 45),
}));

export default function RiskAnalyticsPage() {
  const [riskTrend, setRiskTrend] = useState<RiskTrendPoint[]>(initialRiskTrend);
  const [threatLevel, setThreatLevel] = useState<'low' | 'medium' | 'high'>(
    'low'
  );
  const [riskMetrics, setRiskMetrics] = useState({
    facialRisk: 0,
    behavioralRisk: 0,
    anomalyDetections: 0,
    successfulVerifications: 0,
  });

  // Update data
  useEffect(() => {
    const interval = setInterval(() => {
      const newFacialRisk = 20 + Math.random() * 40;
      const newBehavioralRisk = 25 + Math.random() * 45;
      const overallRisk = (newFacialRisk + newBehavioralRisk) / 2;

      setRiskMetrics({
        facialRisk: Math.round(newFacialRisk),
        behavioralRisk: Math.round(newBehavioralRisk),
        anomalyDetections: Math.floor(Math.random() * 10),
        successfulVerifications: Math.floor(98 + Math.random() * 2),
      });

      // Update threat level
      if (overallRisk < 30) setThreatLevel('low');
      else if (overallRisk < 60) setThreatLevel('medium');
      else setThreatLevel('high');

      // Update trend
      setRiskTrend((prev) => {
        const newData = [
          ...prev.slice(1),
          {
            time: prev[prev.length - 1].time + 1,
            risk: overallRisk,
            facial: newFacialRisk,
            behavioral: newBehavioralRisk,
          },
        ];
        return newData;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'low':
        return '#00ff88';
      case 'medium':
        return '#ffaa00';
      case 'high':
        return '#ff0055';
      default:
        return '#00d4ff';
    }
  };

  const riskByType = [
    { name: 'Facial', value: riskMetrics.facialRisk, color: '#00ff88' },
    {
      name: 'Behavioral',
      value: riskMetrics.behavioralRisk,
      color: '#00d4ff',
    },
  ];

  const chartVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.3 },
    }),
  };

  return (
    <div className="p-6 space-y-6 fade-in-up">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-primary glow">
          Risk Analytics Dashboard
        </h2>
        <p className="text-muted-foreground">
          Comprehensive threat assessment and trend analysis
        </p>
      </div>

      {/* Threat Level Banner */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-lg border-2 p-6"
        style={{ borderColor: getThreatColor(threatLevel) }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundColor: getThreatColor(threatLevel) }} />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              CURRENT THREAT LEVEL
            </h3>
            <div className="flex items-center gap-3">
              <AlertTriangle
                size={32}
                style={{ color: getThreatColor(threatLevel) }}
              />
              <span
                className="text-4xl font-bold uppercase"
                style={{ color: getThreatColor(threatLevel) }}
              >
                {threatLevel}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-2">
              Security Status
            </p>
            <div className="space-y-1 text-xs text-foreground">
              <div>
                Verification Success: {riskMetrics.successfulVerifications}%
              </div>
              <div>Anomalies Detected: {riskMetrics.anomalyDetections}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Facial Risk Score',
            value: riskMetrics.facialRisk,
            unit: '%',
            icon: AlertTriangle,
            color: 'text-primary',
            delay: 0,
          },
          {
            label: 'Behavioral Risk Score',
            value: riskMetrics.behavioralRisk,
            unit: '%',
            icon: TrendingUp,
            color: 'text-accent',
            delay: 0.1,
          },
          {
            label: 'Successful Verifications',
            value: riskMetrics.successfulVerifications,
            unit: '%',
            icon: TrendingDown,
            color: 'text-primary',
            delay: 0.2,
          },
          {
            label: 'Anomalies Detected',
            value: riskMetrics.anomalyDetections,
            unit: '',
            icon: Zap,
            color: 'text-secondary',
            delay: 0.3,
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: metric.delay, duration: 0.3 }}
              className="bg-card border border-border rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-muted-foreground font-semibold">
                  {metric.label}
                </span>
                <Icon size={16} className={metric.color} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${metric.color}`}>
                  {metric.value}
                </span>
                <span className="text-sm text-muted-foreground">
                  {metric.unit}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend Chart */}
        <motion.div
          custom={0}
          variants={chartVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 bg-card border border-border rounded-lg p-4"
        >
          <h3 className="font-semibold text-foreground mb-4">Risk Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={riskTrend}>
              <defs>
                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff0055" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ff0055" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
              <XAxis
                dataKey="time"
                stroke="#8890aa"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis stroke="#8890aa" style={{ fontSize: '0.75rem' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f3a',
                  border: '1px solid #2a2f4a',
                  borderRadius: '0.5rem',
                  color: '#e0e6ff',
                }}
                formatter={(value: number | string | Array<number | string>) => [
                  typeof value === 'number' ? value.toFixed(1) : String(value),
                  '',
                ]}
              />
              <Line
                type="monotone"
                dataKey="risk"
                stroke="#ff0055"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="facial"
                stroke="#00ff88"
                dot={false}
                strokeWidth={1}
                strokeDasharray="5 5"
                opacity={0.6}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="behavioral"
                stroke="#00d4ff"
                dot={false}
                strokeWidth={1}
                strokeDasharray="5 5"
                opacity={0.6}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Risk by Type */}
        <motion.div
          custom={1}
          variants={chartVariants}
          initial="hidden"
          animate="visible"
          className="bg-card border border-border rounded-lg p-4"
        >
          <h3 className="font-semibold text-foreground mb-4">Risk Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={riskByType}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {riskByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f3a',
                  border: '1px solid #2a2f4a',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#e0e6ff' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2 text-xs">
            {riskByType.map((item) => (
              <div key={item.name} className="flex justify-between">
                <span className="text-muted-foreground">{item.name}</span>
                <span style={{ color: item.color }} className="font-semibold">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Detailed Analysis */}
      <motion.div
        custom={2}
        variants={chartVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Verification Statistics */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">
            Verification Statistics
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2 text-xs">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="text-primary font-semibold">
                  {riskMetrics.successfulVerifications}%
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  style={{
                    width: `${riskMetrics.successfulVerifications}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2 text-xs">
                <span className="text-muted-foreground">Facial Detection</span>
                <span className="text-accent font-semibold">
                  {Math.round(100 - riskMetrics.facialRisk)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-accent"
                  style={{
                    width: `${100 - riskMetrics.facialRisk}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2 text-xs">
                <span className="text-muted-foreground">Behavior Analysis</span>
                <span className="text-secondary font-semibold">
                  {Math.round(100 - riskMetrics.behavioralRisk)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-secondary"
                  style={{
                    width: `${100 - riskMetrics.behavioralRisk}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">Security Alerts</h3>
          <div className="space-y-3 text-xs">
            {[
              {
                level: 'info',
                message: 'All biometric systems operational',
                color: 'text-primary',
              },
              {
                level: 'warning',
                message: `${riskMetrics.anomalyDetections} anomalies detected in last hour`,
                color: 'text-secondary',
              },
              {
                level: 'success',
                message: 'Facial recognition accuracy: 98.2%',
                color: 'text-primary',
              },
              {
                level: 'info',
                message: 'Last verification: 2 minutes ago',
                color: 'text-accent',
              },
            ].map((alert, idx) => (
              <div key={idx} className="flex gap-2 p-2 rounded bg-muted/30">
                <div className={`w-1 rounded ${alert.color}`} />
                <span className="text-muted-foreground">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
