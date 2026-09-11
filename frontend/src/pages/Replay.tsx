import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { ReplayResponse, ReplayPoint } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

export default function Replay() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();
  const { isDark } = useTheme();

  const wellId = id || activeWell?.well_id || '';

  const [replayData, setReplayData] = useState<ReplayResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [predictResult, setPredictResult] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [predicting, setPredicting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wellId && activeWell?.well_id !== wellId) {
      setActiveWellId(wellId);
    }
  }, [wellId, activeWell?.well_id, setActiveWellId]);

  const loadReplay = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await wellsApi.getReplay(wellId, 150);
      setReplayData(res);
      setCurrentIndex(0);
      setPredictResult(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load chronological replay timeline.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadReplay();
  }, [loadReplay]);

  // Autoplay ticker
  useEffect(() => {
    let timer: any;
    if (isPlaying && replayData?.replay_points?.length) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= replayData.replay_points.length) {
            setIsPlaying(false);
            return replayData.replay_points.length - 1;
          }
          return next;
        });
      }, 750);
    }
    return () => clearInterval(timer);
  }, [isPlaying, replayData]);

  // Run model on specific point via POST /api/wells/{id}/replay/predict
  const handleRunPredictOnPoint = async () => {
    if (!wellId) return;
    setPredicting(true);
    try {
      const res = await wellsApi.replayPredict(wellId, currentIndex);
      setPredictResult(res);
    } catch (err: any) {
      console.error('Replay predict error:', err);
    } finally {
      setPredicting(false);
    }
  };

  const gridColor = isDark ? '#2E2E2B' : '#ECEAE3';
  const axisColor = isDark ? '#4A4A45' : '#B8B4A8';
  const tooltipBg = isDark ? '#1C1C1A' : '#FFFFFF';
  const tooltipBorder = isDark ? '#2E2E2B' : '#D6D3CB';

  if (loading && !replayData) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Reconstructing historical chronological replay buffer…</span>
        </div>
      </div>
    );
  }

  if (error && !replayData) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertCircle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">{error}</p>
          <button
            onClick={() => loadReplay()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors"
          >
            <RefreshCw size={13} /> Retry Replay
          </button>
        </div>
      </div>
    );
  }

  const points = replayData?.replay_points || [];
  const currentPoint: ReplayPoint | undefined = points[currentIndex];

  const chartData = points.map((p, idx) => ({
    idx,
    time: p.timestamp ? p.timestamp.split('T')[1]?.slice(0, 5) || `P${idx}` : `${idx}`,
    depth: p.depth_m != null ? +p.depth_m.toFixed(1) : 0,
    rop: p.ROP != null ? +p.ROP.toFixed(1) : 0,
    wob: p.WOB != null ? +p.WOB.toFixed(1) : 0,
    score: p.anomaly_score != null ? +(p.anomaly_score * 100).toFixed(1) : 0,
    condition: p.condition || 'Normal',
  }));

  const conditionClass =
    currentPoint?.condition === 'Critical'
      ? 'bg-risk-high/10 text-risk-high border-risk-high/30'
      : currentPoint?.condition === 'Elevated'
      ? 'bg-risk-med/10 text-risk-med border-risk-med/30'
      : 'bg-risk-low/10 text-risk-low border-risk-low/30';

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Historical Chronological Replay"
          sub={`${wellId} · Interactive SCADA Timeline Simulation & Step-Through ML Inference`}
        />
        <button
          onClick={() => loadReplay()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload Buffer
        </button>
      </div>

      {/* ── Player Controls Card ─────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(0);
              }}
              className="p-2 rounded-sm border border-ivory-300 dark:border-night-700 hover:border-gold text-ink-600 dark:text-night-400 hover:text-gold transition-colors"
              title="Rewind to start"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={currentIndex <= 0}
              className="p-2 rounded-sm border border-ivory-300 dark:border-night-700 hover:border-gold text-ink-600 dark:text-night-400 hover:text-gold transition-colors disabled:opacity-30"
              title="Step Backward"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 rounded-sm bg-gold text-night-950 font-semibold text-[12px] flex items-center gap-1.5 hover:bg-gold-600 transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex((prev) => Math.min(points.length - 1, prev + 1));
              }}
              disabled={currentIndex >= points.length - 1}
              className="p-2 rounded-sm border border-ivory-300 dark:border-night-700 hover:border-gold text-ink-600 dark:text-night-400 hover:text-gold transition-colors disabled:opacity-30"
              title="Step Forward"
            >
              <SkipForward size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[12px] num font-medium text-ink-700 dark:text-ivory-300">
              Point <span className="text-gold font-bold">{currentIndex + 1}</span> of {points.length}
            </span>
            <button
              onClick={handleRunPredictOnPoint}
              disabled={predicting}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm bg-ink-900 text-ivory-100 dark:bg-ivory-100 dark:text-ink-900 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Sparkles size={12} className={predicting ? 'animate-spin' : ''} />
              <span>{predicting ? 'Inferring…' : 'Run Model on Point'}</span>
            </button>
          </div>
        </div>

        {/* Scrubber slider */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, points.length - 1)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(parseInt(e.target.value, 10));
            }}
            className="w-full accent-gold cursor-pointer"
          />
          <div className="flex justify-between text-[10px] num text-ink-400 dark:text-night-500">
            <span>{points[0]?.timestamp?.slice(0, 16) || 'Start'}</span>
            <span>{points[points.length - 1]?.timestamp?.slice(0, 16) || 'End'}</span>
          </div>
        </div>
      </div>

      {/* ── Active Point Snapshot ────────────────────────────────────────── */}
      {currentPoint && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="card p-3">
            <p className="section-label">Depth (m)</p>
            <p className="num text-xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
              {currentPoint.depth_m != null ? currentPoint.depth_m.toFixed(1) : '—'}
            </p>
          </div>

          <div className="card p-3">
            <p className="section-label">ROP (m/h)</p>
            <p className="num text-xl font-semibold text-gold mt-1">
              {currentPoint.ROP != null ? currentPoint.ROP.toFixed(1) : '—'}
            </p>
          </div>

          <div className="card p-3">
            <p className="section-label">WOB (kN)</p>
            <p className="num text-xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
              {currentPoint.WOB != null ? currentPoint.WOB.toFixed(1) : '—'}
            </p>
          </div>

          <div className="card p-3">
            <p className="section-label">RPM</p>
            <p className="num text-xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
              {currentPoint.RPM != null ? currentPoint.RPM.toFixed(0) : '—'}
            </p>
          </div>

          <div className="card p-3">
            <p className="section-label">Torque (kNm)</p>
            <p className="num text-xl font-semibold text-ink-900 dark:text-ivory-100 mt-1">
              {currentPoint.Torque != null ? currentPoint.Torque.toFixed(1) : '—'}
            </p>
          </div>

          <div className="card p-3">
            <p className="section-label">Condition</p>
            <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border mt-1 ${conditionClass}`}>
              {currentPoint.condition || 'Normal'}
            </span>
          </div>
        </div>
      )}

      {/* Model On-Point Predict Response Callout */}
      {predictResult && (
        <div className="card p-4 bg-gold/5 border-gold/30 flex items-start gap-3">
          <Sparkles size={18} className="text-gold shrink-0 mt-0.5" />
          <div className="text-[12px] space-y-1">
            <p className="font-semibold text-ink-900 dark:text-ivory-100">
              Live Model Inference on Point #{currentIndex + 1}
            </p>
            <p className="text-ink-600 dark:text-night-400">
              Condition: <span className="font-semibold text-gold">{predictResult.condition}</span> ·
              Anomaly Score: <span className="font-semibold text-gold">{predictResult.anomaly_score != null ? predictResult.anomaly_score.toFixed(4) : 'N/A'}</span> ·
              Model: {predictResult.model_version || 'IsolationForest'}
            </p>
          </div>
        </div>
      )}

      {/* ── Progression Chart ────────────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <SectionHeader
          title="Timeline Progression & Anomaly Envelope"
          sub="Synchronized progression of ROP alongside Isolation Forest anomaly score"
          className="mb-4"
        />

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis yAxisId="left" stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#C0392B"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#C0392B' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div
                      className="card p-3 shadow-lg text-[11px] space-y-1"
                      style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder }}
                    >
                      <p className="font-semibold text-ink-900 dark:text-ivory-100">Timestamp: {d.time}</p>
                      <p className="text-gold">ROP: {d.rop} m/h</p>
                      <p className="text-[#2E7D4F]">WOB: {d.wob} kN</p>
                      <p className="text-risk-high font-semibold">Anomaly: {d.score}% ({d.condition})</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine yAxisId="left" x={chartData[currentIndex]?.time} stroke="#C9A84C" strokeDasharray="2 2" />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="rop" name="ROP (m/h)" stroke="#C9A84C" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="score" name="Anomaly Score %" stroke="#C0392B" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
