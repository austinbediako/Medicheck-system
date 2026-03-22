// =============================================================================
// MediCheck — Shared TypeScript Interfaces
// =============================================================================

// ---------------------------------------------------------------------------
// Prolog inference result (mirroring bridge.pl JSON output)
// ---------------------------------------------------------------------------
export type ConfidenceLevel = 'high' | 'medium' | 'possible' | 'none';

export interface PrologResult {
  diagnosis: string;
  confidence: ConfidenceLevel;
  rules_fired: string[];
  matched_symptoms: string[];
  reasoning: string;
  advice: string;
  error: string | null;
}

// ---------------------------------------------------------------------------
// API Request / Response shapes
// ---------------------------------------------------------------------------
export interface DiagnosisRequest {
  symptoms: string[];
  symptom_duration?: 'less_than_2_weeks' | 'more_than_2_weeks' | 'unknown';
  session_id?: string;
}

export interface DiagnosisResponse {
  session_id: string;
  diagnosis_id: number;
  diagnosis: string;
  confidence: ConfidenceLevel;
  rules_fired: string[];
  matched_symptoms: string[];
  reasoning: string;
  advice: string;
  symptoms_submitted: string[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Database row shapes
// ---------------------------------------------------------------------------
export interface DiagnosisRow {
  id: number;
  session_id: string;
  symptoms: string[];
  diagnosis: string;
  confidence: ConfidenceLevel;
  rules_fired: string[];
  matched_symptoms: string[];
  reasoning: string;
  advice: string;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Symptoms catalog
// ---------------------------------------------------------------------------
export interface SymptomCatalogRow {
  id: number;
  name: string;
  display_name: string;
  disease_category: string;
}

export interface SymptomsByCategory {
  [category: string]: Array<{ name: string; display_name: string }>;
}

export interface SymptomsResponse {
  categories: SymptomsByCategory;
  all_symptoms: Array<{ name: string; display_name: string; category: string }>;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export interface HistoryResponse {
  session_id: string;
  count: number;
  diagnoses: DiagnosisResponse[];
}
