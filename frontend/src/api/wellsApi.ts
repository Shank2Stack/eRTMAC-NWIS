/**
 * frontend/src/api/wellsApi.ts
 * Real well services for eRTMAC-NWIS FastAPI backend.
 */

import { apiFetch, encodeWellId } from './client';
import type {
  WellSummary,
  WellState,
  Prediction,
  Evidence,
  SimilarWellsResponse,
  CompareResponse,
  InvestigationResponse,
  WhatIfResponse,
  ReplayResponse,
  HealthResponse,
} from '../types/api';

/**
 * Retrieve list of all wells.
 */
export async function getWells(): Promise<WellSummary[]> {
  return apiFetch<WellSummary[]>('/api/wells');
}

/**
 * Retrieve summary of a single well.
 */
export async function getWell(wellId: string): Promise<WellSummary> {
  const enc = encodeWellId(wellId);
  return apiFetch<WellSummary>(`/api/wells/${enc}`);
}

/**
 * Retrieve real-time data state of a single well.
 */
export async function getWellData(wellId: string): Promise<WellState> {
  const enc = encodeWellId(wellId);
  return apiFetch<WellState>(`/api/wells/${enc}/data`);
}

/**
 * Retrieve ML anomaly prediction for the well.
 */
export async function getPrediction(wellId: string): Promise<Prediction> {
  const enc = encodeWellId(wellId);
  return apiFetch<Prediction>(`/api/wells/${enc}/prediction`);
}

/**
 * Retrieve explainability evidence and supporting records.
 */
export async function getEvidence(wellId: string): Promise<Evidence> {
  const enc = encodeWellId(wellId);
  return apiFetch<Evidence>(`/api/wells/${enc}/evidence`);
}

/**
 * Retrieve similar offset wells based on standardised features.
 */
export async function getSimilarWells(wellId: string, k: number = 5): Promise<SimilarWellsResponse> {
  const enc = encodeWellId(wellId);
  return apiFetch<SimilarWellsResponse>(`/api/wells/${enc}/similar?k=${k}`);
}

/**
 * Compare current well state with a historical offset well.
 */
export async function compareWells(wellId: string, historicalWellId: string): Promise<CompareResponse> {
  const enc1 = encodeWellId(wellId);
  const enc2 = encodeWellId(historicalWellId);
  return apiFetch<CompareResponse>(`/api/wells/${enc1}/compare/${enc2}`);
}

/**
 * Retrieve forensic chronological root cause investigation timeline.
 */
export async function getInvestigation(wellId: string): Promise<InvestigationResponse> {
  const enc = encodeWellId(wellId);
  return apiFetch<InvestigationResponse>(`/api/wells/${enc}/investigate`);
}

/**
 * Run What-If simulation with parameter overrides.
 * Note: Simulation only — does not alter actual equipment or dataset.
 */
export async function runWhatIf(
  wellId: string,
  overrides: Record<string, number>
): Promise<WhatIfResponse> {
  const enc = encodeWellId(wellId);
  return apiFetch<WhatIfResponse>(`/api/wells/${enc}/what-if`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ overrides }),
  });
}

/**
 * Retrieve historical replay timeline.
 */
export async function getReplay(wellId: string, maxPoints: number = 100): Promise<ReplayResponse> {
  const enc = encodeWellId(wellId);
  // Backend requires max_points between 10 and 500
  const points = Math.max(10, Math.min(500, maxPoints));
  return apiFetch<ReplayResponse>(`/api/wells/${enc}/replay?max_points=${points}`);
}

/**
 * Run ML model on a specific replay point by index.
 */
export async function replayPredict(wellId: string, pointIndex: number): Promise<any> {
  const enc = encodeWellId(wellId);
  return apiFetch<any>(`/api/wells/${enc}/replay/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ point_index: pointIndex }),
  });
}

/**
 * Public health status check.
 */
export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health');
}
