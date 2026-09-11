import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, RefreshCw, Play, Pause, SkipForward, SkipBack, AlertTriangle, ShieldCheck } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { WellState, Prediction, ReplayPoint } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellboreScene from '../components/three/WellboreScene';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import StatusDot from '../components/ui/StatusDot';

export default function WellboreTwin() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();
  const { isDark } = useTheme();

  const wellId = id || activeWell?.well_id || '';

  const [wellState, setWellState] = useState<WellState | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [replayPoints, setReplayPoints] = useState<ReplayPoint[]>([]);
  const [activeReplayIdx, setActiveReplayIdx] = useState<number | null>(null);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [riskPanelOpen, setRiskPanelOpen] = useState<boolean>(false);

  useEffect(() => {
    if (wellId && activeWell?.well_id !== wellId) {
      setActiveWellId(wellId);
    }
  }, [wellId, activeWell?.well_id, setActiveWellId]);

  const loadData = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const [stateData, predData, replayData] = await Promise.all([
        wellsApi.getWellData(wellId),
        wellsApi.getPrediction(wellId),
        wellsApi.getReplay(wellId, 100).catch(() => ({ replay_points: [] })),
      ]);
      setWellState(stateData);
      setPrediction(predData);
      setReplayPoints(replayData.replay_points || []);
      setActiveReplayIdx(null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load well telemetry and anomaly prediction.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Replay Playback
  useEffect(() => {
    let timer: any;
    if (isPlayingReplay && replayPoints.length > 0) {
      timer = setInterval(() => {
        setActiveReplayIdx((curr) => {
          const next = (curr ?? 0) + 1;
          if (next >= replayPoints.length) {
            setIsPlayingReplay(false);
            return replayPoints.length - 1;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlayingReplay, replayPoints.length]);

  if (loading && !wellState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-ivory-100 dark:bg-night-950 text-ink-600 dark:text-night-400 gap-3">
        <RefreshCw className="animate-spin text-gold" size={24} />
        <span className="text-[13px] font-medium">Loading 3D wellbore state & SCADA telemetry…</span>
      </div>
    );
  }

  if (error && !wellState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-ivory-100 dark:bg-night-950 p-6">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertTriangle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">{error}</p>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Determine displayed point (live state vs replay point)
  const isReplayActive = activeReplayIdx !== null && replayPoints[activeReplayIdx];
  const activePoint = isReplayActive ? replayPoints[activeReplayIdx] : null;

  const currentDepth = activePoint?.depth_m ?? wellState?.drilling?.depth_m ?? 3200;
  const totalDepth = Math.max(currentDepth * 1.25, 4000);

  const displayRop = activePoint?.ROP ?? wellState?.drilling?.ROP;
  const displayWob = activePoint?.WOB ?? wellState?.drilling?.WOB;
  const displayRpm = activePoint?.RPM ?? wellState?.drilling?.RPM;
  const displayTorque = activePoint?.Torque ?? wellState?.drilling?.Torque;

  const anomalyCondition = activePoint?.condition ?? prediction?.condition ?? 'Normal';
  const anomalyScore = activePoint?.anomaly_score ?? prediction?.anomaly_score ?? 0;

  const conditionColor =
    anomalyCondition === 'Critical'
      ? 'text-risk-high'
      : anomalyCondition === 'Elevated'
      ? 'text-risk-med'
      : 'text-risk-low';

  const conditionBg =
    anomalyCondition === 'Critical'
      ? 'bg-risk-high/10 border-risk-high/30 text-risk-high'
      : anomalyCondition === 'Elevated'
      ? 'bg-risk-med/10 border-risk-med/30 text-risk-med'
      : 'bg-risk-low/10 border-risk-low/30 text-risk-low';

  // Standard geological formations based on depth
  const formations = [
    { name: 'Nordland Group (Claystone)', topDepth: 0, bottomDepth: 1000, lithology: 'shale' as const, color: '#7D6E56' },
    { name: 'Utsira Sandstone Formation', topDepth: 1000, bottomDepth: 1800, lithology: 'sandstone' as const, color: '#C9A460' },
    { name: 'Hordaland Chalk Horizon', topDepth: 1800, bottomDepth: 2600, lithology: 'limestone' as const, color: '#8FA8B8' },
    { name: 'Skade Sandstone Reservoir', topDepth: 2600, bottomDepth: 3500, lithology: 'sandstone' as const, color: '#C9A460' },
    { name: 'Ty Deep Carbonates', topDepth: 3500, bottomDepth: 4500, lithology: 'dolomite' as const, color: '#9CA3AF' },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-ivory-100 dark:bg-night-950 overflow-hidden">
      {/* ── 3D Canvas Area ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 lg:relative lg:h-full h-full">
          <WellboreScene
            formations={formations}
            currentDepth={currentDepth}
            totalDepth={totalDepth}
            isDark={isDark}
          />
        </div>

        {/* Breadcrumb overlay */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <WellBreadcrumb />
        </div>

        {/* Depth overlay (bottom-left) */}
        <div className="absolute bottom-4 left-4 card px-3.5 py-2.5 bg-white/90 dark:bg-night-900/90 backdrop-blur-sm shadow-sm">
          <p className="section-label">Measured Depth (MD)</p>
          <p className="num text-lg font-semibold text-ink-900 dark:text-ivory-100">
            {currentDepth != null ? currentDepth.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}{' '}
            <span className="text-xs font-normal text-ink-400">meters</span>
          </p>
          {isReplayActive && (
            <p className="text-[10px] num text-gold mt-0.5">
              Replay Point #{activeReplayIdx + 1} of {replayPoints.length}
            </p>
          )}
        </div>

        {/* Replay Controls Pill (bottom-center) */}
        {replayPoints.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 card px-3 py-1.5 bg-white/90 dark:bg-night-900/90 backdrop-blur-sm shadow-sm flex items-center gap-2">
            <span className="text-[10px] section-label">Replay</span>
            <button
              onClick={() => setActiveReplayIdx((curr) => Math.max(0, (curr ?? 0) - 1))}
              disabled={activeReplayIdx === 0}
              className="p-1 rounded hover:bg-gold/10 text-ink-600 dark:text-night-400 disabled:opacity-30"
              title="Previous Point"
            >
              <SkipBack size={13} />
            </button>
            <button
              onClick={() => {
                if (activeReplayIdx === null) setActiveReplayIdx(0);
                setIsPlayingReplay(!isPlayingReplay);
              }}
              className="p-1 rounded bg-gold/10 text-gold hover:bg-gold/20"
              title={isPlayingReplay ? 'Pause' : 'Play Timeline'}
            >
              {isPlayingReplay ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              onClick={() => setActiveReplayIdx((curr) => Math.min(replayPoints.length - 1, (curr ?? 0) + 1))}
              disabled={activeReplayIdx === replayPoints.length - 1}
              className="p-1 rounded hover:bg-gold/10 text-ink-600 dark:text-night-400 disabled:opacity-30"
              title="Next Point"
            >
              <SkipForward size={13} />
            </button>
            {isReplayActive && (
              <button
                onClick={() => {
                  setActiveReplayIdx(null);
                  setIsPlayingReplay(false);
                }}
                className="text-[10px] num text-ink-400 hover:text-gold px-1"
              >
                Reset to Live
              </button>
            )}
          </div>
        )}

        {/* Mobile risk toggle button */}
        <button
          onClick={() => setRiskPanelOpen((o) => !o)}
          className="
            absolute bottom-4 right-4
            lg:hidden
            inline-flex items-center gap-1.5 px-3 py-2 rounded-sm
            bg-white/90 dark:bg-night-900/90 backdrop-blur-sm
            border border-ivory-300 dark:border-night-700
            text-[11px] font-semibold text-ink-700 dark:text-ivory-300
          "
        >
          Operational Panel
          {riskPanelOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {/* ── Operational / Telemetry Right Panel ───────────────────────────── */}
      <div
        className={`
          shrink-0
          bg-white dark:bg-night-900
          border-t lg:border-t-0 lg:border-l border-ivory-300 dark:border-night-700
          flex flex-col p-4 lg:p-5 gap-4
          overflow-y-auto
          lg:w-80 lg:h-full
          transition-all duration-200
          ${riskPanelOpen ? 'h-96' : 'h-0 overflow-hidden'}
          lg:h-full
        `}
      >
        {/* Well identity */}
        <div className="flex items-start justify-between">
          <div>
            <p className="section-label mb-1">Active Well</p>
            <h2 className="text-[15px] font-semibold text-ink-900 dark:text-ivory-100 leading-tight">
              {wellId}
            </h2>
            <p className="text-[11px] text-ink-400 dark:text-night-500">Volve Field · North Sea</p>
          </div>
          <button
            onClick={() => loadData()}
            className="p-1 rounded hover:bg-ivory-100 dark:hover:bg-night-800 text-ink-400 hover:text-gold transition-colors"
            title="Reload telemetry"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="divider" />

        {/* Isolation Forest Anomaly Detection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Anomaly Indicator</p>
            <span className="text-[10px] num text-ink-400 dark:text-night-500">Isolation Forest</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="card p-3 overflow-hidden">
              <p className="section-label truncate">Drilling Condition</p>
              <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${conditionBg}`}>
                {anomalyCondition}
              </span>
            </div>

            <div className="card p-3 overflow-hidden">
              <p className="section-label truncate">Anomaly Score</p>
              <p className={`num text-xl font-semibold leading-tight mt-1 ${conditionColor}`}>
                {anomalyScore.toFixed(3)}
              </p>
              <p className="text-[9px] text-ink-400 dark:text-night-500">0.0 (Normal) – 1.0 (Crit)</p>
            </div>
          </div>

          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-2 leading-tight">
            * Anomaly score represents feature divergence, not operational failure probability.
          </p>
        </div>

        <div className="divider" />

        {/* Real Drilling Parameters */}
        <div>
          <p className="section-label mb-2.5">Current Drilling Telemetry</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-sm bg-ivory-50 dark:bg-night-800/60 border border-ivory-200 dark:border-night-700/60">
              <p className="section-label text-[10px]">ROP</p>
              <p className="num text-[13px] font-semibold text-ink-900 dark:text-ivory-100">
                {displayRop != null ? displayRop.toFixed(1) : '—'} <span className="text-[10px] font-normal text-ink-400">m/h</span>
              </p>
            </div>

            <div className="p-2.5 rounded-sm bg-ivory-50 dark:bg-night-800/60 border border-ivory-200 dark:border-night-700/60">
              <p className="section-label text-[10px]">WOB</p>
              <p className="num text-[13px] font-semibold text-ink-900 dark:text-ivory-100">
                {displayWob != null ? displayWob.toFixed(1) : '—'} <span className="text-[10px] font-normal text-ink-400">kN</span>
              </p>
            </div>

            <div className="p-2.5 rounded-sm bg-ivory-50 dark:bg-night-800/60 border border-ivory-200 dark:border-night-700/60">
              <p className="section-label text-[10px]">RPM</p>
              <p className="num text-[13px] font-semibold text-ink-900 dark:text-ivory-100">
                {displayRpm != null ? displayRpm.toFixed(0) : '—'} <span className="text-[10px] font-normal text-ink-400">rpm</span>
              </p>
            </div>

            <div className="p-2.5 rounded-sm bg-ivory-50 dark:bg-night-800/60 border border-ivory-200 dark:border-night-700/60">
              <p className="section-label text-[10px]">Torque</p>
              <p className="num text-[13px] font-semibold text-ink-900 dark:text-ivory-100">
                {displayTorque != null ? displayTorque.toFixed(1) : '—'} <span className="text-[10px] font-normal text-ink-400">kNm</span>
              </p>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Mud State */}
        {wellState?.mud && (
          <div>
            <p className="section-label mb-2">Mud & Hydraulics Readings</p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-ink-500 dark:text-night-400">Mud Flow Rate</span>
                <span className="num text-ink-800 dark:text-ivory-200 font-medium">
                  {wellState.mud.mud_flow_rate != null ? `${wellState.mud.mud_flow_rate.toFixed(1)} L/min` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500 dark:text-night-400">Mud Pressure</span>
                <span className="num text-ink-800 dark:text-ivory-200 font-medium">
                  {wellState.mud.mud_pressure != null ? `${wellState.mud.mud_pressure.toFixed(1)} bar` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500 dark:text-night-400">Mud Weight</span>
                <span className="num text-ink-800 dark:text-ivory-200 font-medium">
                  {wellState.mud.mud_weight != null ? `${wellState.mud.mud_weight.toFixed(2)} SG` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Production context */}
        {wellState?.production && (
          <div className="mt-auto pt-2 text-[10px] text-ink-400 dark:text-night-500 border-t border-ivory-200 dark:border-night-800 flex justify-between">
            <span>Well Type: {wellState.production.well_type || 'OP'}</span>
            <span>Downhole: {wellState.production.avg_downhole_pressure_bar != null ? `${wellState.production.avg_downhole_pressure_bar.toFixed(0)} bar` : '—'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
