import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { TrendingDown, TrendingUp, Minus, Play, RefreshCw, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { WellState, WhatIfResponse } from '../types/api';
import { useWell } from '../context/WellContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

interface SliderParam {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
}

const DEFAULT_PARAMS: SliderParam[] = [
  { key: 'ROP',           label: 'Rate of Penetration (ROP)',  unit: 'm/h',   min: 0,   max: 60,   step: 0.5, defaultVal: 15.0 },
  { key: 'WOB',           label: 'Weight on Bit (WOB)',        unit: 'kN',    min: 0,   max: 200,  step: 1,   defaultVal: 45.0 },
  { key: 'RPM',           label: 'Rotary Speed (RPM)',         unit: 'rpm',   min: 0,   max: 250,  step: 5,   defaultVal: 110.0 },
  { key: 'Torque',        label: 'Drill String Torque',        unit: 'kNm',   min: 0,   max: 40,   step: 0.5, defaultVal: 12.0 },
  { key: 'mud_flow_rate', label: 'Mud Flow Rate',              unit: 'L/min', min: 200, max: 4000, step: 50,  defaultVal: 1800.0 },
  { key: 'mud_pressure',  label: 'Mud Pump Pressure',          unit: 'bar',   min: 10,  max: 350,  step: 5,   defaultVal: 140.0 },
];

export default function WhatIf() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();

  const wellId = id || activeWell?.well_id || '';

  const [wellState, setWellState] = useState<WellState | null>(null);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());
  const [simulationResult, setSimulationResult] = useState<WhatIfResponse | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [runningSimulation, setRunningSimulation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wellId && activeWell?.well_id !== wellId) {
      setActiveWellId(wellId);
    }
  }, [wellId, activeWell?.well_id, setActiveWellId]);

  // Load initial well state to populate initial slider defaults
  const loadWellState = useCallback(async () => {
    if (!wellId) return;
    setLoadingInitial(true);
    setError(null);
    try {
      const state = await wellsApi.getWellData(wellId);
      setWellState(state);

      const initialVals: Record<string, number> = {};
      DEFAULT_PARAMS.forEach((p) => {
        let liveVal: number | undefined;
        if (p.key in (state.drilling || {})) {
          liveVal = (state.drilling as any)[p.key];
        } else if (p.key in (state.mud || {})) {
          liveVal = (state.mud as any)[p.key];
        }
        initialVals[p.key] = liveVal != null ? Number(liveVal) : p.defaultVal;
      });

      setSliderValues(initialVals);
      setModifiedKeys(new Set());
      setSimulationResult(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load baseline well data.');
    } finally {
      setLoadingInitial(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadWellState();
  }, [loadWellState]);

  // Slider change only updates local UI state (no backend call on slider movement)
  const handleSliderChange = (key: string, val: number) => {
    setSliderValues((prev) => ({ ...prev, [key]: val }));
    setModifiedKeys((prev) => new Set(prev).add(key));
  };

  // Explicit user action to run simulation
  const handleRunSimulation = async () => {
    if (!wellId) return;
    setError('');

    // Prepare overrides
    const overrides: Record<string, number> = {};
    if (modifiedKeys.size === 0) {
      // If none touched, send all current slider values
      DEFAULT_PARAMS.forEach((p) => {
        overrides[p.key] = sliderValues[p.key];
      });
    } else {
      modifiedKeys.forEach((key) => {
        overrides[key] = sliderValues[key];
      });
    }

    setRunningSimulation(true);
    try {
      const result = await wellsApi.runWhatIf(wellId, overrides);
      setSimulationResult(result);
    } catch (err: any) {
      setError(err?.message || 'Simulation failed. Please check override parameters.');
    } finally {
      setRunningSimulation(false);
    }
  };

  const handleResetSliders = () => {
    loadWellState();
  };

  const delta = simulationResult ? simulationResult.score_change : 0;
  const DeltaIcon = delta < -0.01 ? TrendingDown : delta > 0.01 ? TrendingUp : Minus;
  const deltaColor = delta < -0.01 ? 'text-risk-low' : delta > 0.01 ? 'text-risk-high' : 'text-risk-med';

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="What-If Operational Sandbox"
          sub={`${wellId} · Counterfactual Machine Learning Inference`}
        />
        <button
          onClick={handleResetSliders}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={12} /> Reset to Live Baseline
        </button>
      </div>

      {/* ── Sandbox Disclaimer Notice ────────────────────────────────────── */}
      <div className="card p-3.5 sm:p-4 bg-gold/5 border-gold/20 flex items-start gap-3">
        <ShieldAlert size={18} className="text-gold shrink-0 mt-0.5" />
        <div className="text-[12px] space-y-1">
          <p className="font-semibold text-ink-900 dark:text-ivory-100">
            Decision-Support Simulation Sandbox
          </p>
          <p className="text-ink-600 dark:text-night-400 leading-relaxed">
            Adjust hypothetical operating parameters below and run inference to predict anomaly trajectory.
            This scenario analysis is purely algorithmic and does not alter actual downhole drilling equipment or datasets.
          </p>
        </div>
      </div>

      {error && (
        <div className="card p-3 bg-risk-high/10 border-risk-high/30 text-risk-high text-[12px] flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Layout: Sliders (Left) vs Results (Right) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Sliders Card */}
        <div className="card p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-ivory-200 dark:border-night-800 pb-3">
            <div>
              <p className="section-label">Scenario Overrides</p>
              <p className="text-[11px] text-ink-400 dark:text-night-500">
                Adjust values locally, then click Run Simulation
              </p>
            </div>
            {modifiedKeys.size > 0 && (
              <span className="badge bg-gold/10 text-gold border border-gold/20 text-[10px] px-2 py-0.5">
                {modifiedKeys.size} modified
              </span>
            )}
          </div>

          <div className="space-y-4">
            {DEFAULT_PARAMS.map((p) => {
              const val = sliderValues[p.key] ?? p.defaultVal;
              const isModified = modifiedKeys.has(p.key);
              return (
                <div key={p.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-ink-700 dark:text-ivory-300 flex items-center gap-1.5">
                      {p.label}
                      {isModified && (
                        <span className="w-1.5 h-1.5 rounded-full bg-gold" title="Parameter modified" />
                      )}
                    </label>
                    <span className="num text-[12px] font-semibold text-gold">
                      {val.toFixed(p.step < 1 ? 1 : 0)} {p.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={val}
                    onChange={(e) => handleSliderChange(p.key, parseFloat(e.target.value))}
                    className="w-full accent-gold cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] num text-ink-400 dark:text-night-500">
                    <span>{p.min} {p.unit}</span>
                    <span>{p.max} {p.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={runningSimulation}
            className="
              w-full mt-4 inline-flex items-center justify-center gap-2
              py-2.5 px-4 rounded-sm text-[13px] font-semibold
              bg-gold hover:bg-gold-600 text-night-950
              transition-colors disabled:opacity-50 cursor-pointer shadow-sm
            "
          >
            {runningSimulation ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Evaluating Isolation Forest Model…
              </>
            ) : (
              <>
                <Play size={14} /> Run Simulation Scenario
              </>
            )}
          </button>
        </div>

        {/* Results Card */}
        <div className="card p-4 sm:p-6 space-y-5">
          <SectionHeader
            title="Simulated Output"
            sub="Model anomaly evaluation for hypothetical drilling scenario"
          />

          {simulationResult ? (
            <div className="space-y-5">
              {/* Score comparison row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-sm bg-ivory-50 dark:bg-night-800/60 border border-ivory-200 dark:border-night-700/60">
                  <p className="section-label">Baseline Anomaly Score</p>
                  <p className="num text-2xl font-semibold text-ink-800 dark:text-ivory-200 mt-1">
                    {simulationResult.current_anomaly_score.toFixed(3)}
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-night-400 mt-0.5">
                    Condition: <span className="font-semibold">{simulationResult.current_condition}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-sm bg-gold/5 border border-gold/30">
                  <p className="section-label text-gold">Simulated Score</p>
                  <p className={`num text-2xl font-semibold mt-1 ${deltaColor}`}>
                    {simulationResult.scenario_anomaly_score.toFixed(3)}
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-night-400 mt-0.5">
                    Condition: <span className="font-semibold">{simulationResult.scenario_condition}</span>
                  </p>
                </div>
              </div>

              {/* Delta Banner */}
              <div className="p-3 rounded-sm border border-ivory-200 dark:border-night-700 flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink-600 dark:text-night-400">Score Impact</span>
                <div className="flex items-center gap-1.5">
                  <DeltaIcon size={16} className={deltaColor} />
                  <span className={`num text-[14px] font-semibold ${deltaColor}`}>
                    {delta > 0 ? `+${delta.toFixed(4)}` : delta.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Changed Features */}
              {simulationResult.changed_features && Object.keys(simulationResult.changed_features).length > 0 && (
                <div>
                  <p className="section-label mb-2">Simulated Parameter Overrides</p>
                  <div className="space-y-1.5 text-[12px]">
                    {Object.entries(simulationResult.changed_features).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-ivory-100 dark:border-night-800">
                        <span className="text-ink-600 dark:text-night-400 font-medium">{k}</span>
                        <span className="num font-semibold text-gold">{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Backend disclaimer */}
              {simulationResult.disclaimer && (
                <p className="text-[11px] text-ink-400 dark:text-night-500 italic leading-relaxed pt-2 border-t border-ivory-200 dark:border-night-800">
                  {simulationResult.disclaimer}
                </p>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-ink-400 dark:text-night-500 space-y-2">
              <Sparkles size={28} className="mx-auto text-gold opacity-60" />
              <p className="text-[13px] font-medium text-ink-700 dark:text-ivory-300">
                Ready to Run Scenario Simulation
              </p>
              <p className="text-[11px] max-w-xs mx-auto">
                Adjust the drilling parameter sliders on the left and click "Run Simulation Scenario" to test the ML anomaly condition.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
