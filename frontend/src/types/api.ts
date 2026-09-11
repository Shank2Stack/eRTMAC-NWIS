/**
 * API schemas matching backend/schemas.py
 */

export interface LoginRequest {
  employee_id: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  employee_id: string;
  name: string;
}

export interface CurrentUser {
  employee_id: string;
  name: string;
}

export interface WellSummary {
  well_id: string;
  well_type?: string | null;
  latest_depth_m?: number | null;
  latest_timestamp?: string | null;
  oil_production?: number | null;
  gas_production?: number | null;
}

export interface DrillingState {
  timestamp?: string | null;
  depth_m?: number | null;
  ROP?: number | null;
  WOB?: number | null;
  RPM?: number | null;
  Torque?: number | null;
}

export interface MudState {
  mud_flow_rate?: number | null;
  mud_pressure?: number | null;
  mud_loss_rate?: number | null;
  mud_weight?: number | null;
}

export interface WellProductionState {
  avg_downhole_pressure_bar?: number | null;
  avg_downhole_temperature_c?: number | null;
  avg_choke_size_pct?: number | null;
  avg_wellhead_pressure_bar?: number | null;
  avg_wellhead_temperature_c?: number | null;
  dp_choke_size_bar?: number | null;
  oil_production?: number | null;
  gas_production?: number | null;
  water_production?: number | null;
  well_type?: string | null;
}

export interface WellState {
  well_id: string;
  drilling: DrillingState;
  mud: MudState;
  production: WellProductionState;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
  description: string;
}

export interface Prediction {
  well_id: string;
  condition: 'Normal' | 'Elevated' | 'Critical' | string;
  anomaly_score: number;
  model_version: string;
  timestamp: string;
  disclaimer: string;
  features_used: string[];
  feature_contributions: FeatureContribution[];
}

export interface Evidence {
  well_id: string;
  current_features: Record<string, any>;
  feature_contributions: FeatureContribution[];
  supporting_records: Record<string, any>[];
  note: string;
}

export interface SimilarWell {
  well_id: string;
  similarity_score: number;
  matched_features: Record<string, any>;
  distance: number;
}

export interface SimilarWellsResponse {
  well_id: string;
  similar_wells: SimilarWell[];
  method: string;
}

export interface FeatureDiff {
  feature: string;
  current_value?: number | null;
  historical_value?: number | null;
  diff?: number | null;
  pct_diff?: number | null;
}

export interface CompareResponse {
  current_well_id: string;
  historical_well_id: string;
  feature_diffs: FeatureDiff[];
  similarity_score: number;
  current_condition: string;
  historical_condition: string;
}

export interface TimelinePoint {
  timestamp: string;
  depth_m?: number | null;
  ROP?: number | null;
  WOB?: number | null;
  RPM?: number | null;
  Torque?: number | null;
  anomaly_score?: number | null;
  condition?: string | null;
}

export interface InvestigationResponse {
  well_id: string;
  timeline: TimelinePoint[];
  anomaly_points: TimelinePoint[];
  depth_range: { min_depth?: number; max_depth?: number; [key: string]: any };
  note: string;
}

export interface WhatIfRequest {
  ROP?: number;
  WOB?: number;
  RPM?: number;
  Torque?: number;
  depth_m?: number;
  mud_flow_rate?: number;
  mud_pressure?: number;
  mud_loss_rate?: number;
  mud_weight?: number;
  overrides?: Record<string, number>;
}

export interface WhatIfResponse {
  well_id: string;
  current_condition: string;
  current_anomaly_score: number;
  scenario_condition: string;
  scenario_anomaly_score: number;
  score_change: number;
  changed_features: Record<string, any>;
  disclaimer: string;
}

export interface ReplayPoint {
  timestamp: string;
  depth_m?: number | null;
  ROP?: number | null;
  WOB?: number | null;
  RPM?: number | null;
  Torque?: number | null;
  anomaly_score?: number | null;
  condition?: string | null;
  features_at_point: Record<string, any>;
}

export interface ReplayResponse {
  well_id: string;
  total_points: number;
  total_available_points?: number | null;
  subsampled?: boolean;
  replay_points: ReplayPoint[];
}

export interface HealthResponse {
  status: string;
  system_status: string;
  api_alive: boolean;
  core_data_loaded: boolean;
  auxiliary_datasets: Record<string, boolean>;
  model_loaded: boolean;
  data_loaded: boolean;
  wells_count: number;
  drilling_records: number;
}
