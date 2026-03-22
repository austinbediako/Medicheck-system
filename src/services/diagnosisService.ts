import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { runPrologInference } from './prologBridge';
import {
  DiagnosisRequest,
  DiagnosisResponse,
  HistoryResponse,
  SymptomsResponse,
  SymptomCatalogRow,
} from '../types/index';

// ---------------------------------------------------------------------------
// runDiagnosis
//
// Orchestrates the full diagnosis flow:
//   1. Validate input
//   2. Call Prolog inference engine (forward chaining)
//   3. Persist result to PostgreSQL
//   4. Return structured response
// ---------------------------------------------------------------------------
export async function runDiagnosis(req: DiagnosisRequest): Promise<DiagnosisResponse> {
  const {
    symptoms,
    symptom_duration = 'unknown',
    session_id = uuidv4(),
  } = req;

  if (!symptoms || symptoms.length === 0) {
    throw new Error('At least one symptom must be provided.');
  }

  // Sanitise: lowercase, trim, replace spaces with underscores
  const cleanedSymptoms = symptoms.map((s) =>
    s.toLowerCase().trim().replace(/\s+/g, '_')
  );

  // --- Call Prolog inference engine ---
  const prologResult = await runPrologInference(cleanedSymptoms, symptom_duration);

  // --- Persist to database ---
  const insertQuery = `
    INSERT INTO diagnoses
      (session_id, symptoms, diagnosis, confidence, rules_fired, matched_symptoms, reasoning, advice)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, created_at
  `;

  const { rows } = await pool.query(insertQuery, [
    session_id,
    JSON.stringify(cleanedSymptoms),
    prologResult.diagnosis,
    prologResult.confidence,
    JSON.stringify(prologResult.rules_fired),
    JSON.stringify(prologResult.matched_symptoms),
    prologResult.reasoning,
    prologResult.advice,
  ]);

  const row = rows[0];

  return {
    session_id,
    diagnosis_id:       row.id,
    diagnosis:          prologResult.diagnosis,
    confidence:         prologResult.confidence,
    rules_fired:        prologResult.rules_fired,
    matched_symptoms:   prologResult.matched_symptoms,
    reasoning:          prologResult.reasoning,
    advice:             prologResult.advice,
    symptoms_submitted: cleanedSymptoms,
    created_at:         row.created_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// getHistory
//
// Returns all past diagnoses for a given session UUID.
// ---------------------------------------------------------------------------
export async function getHistory(sessionId: string): Promise<HistoryResponse> {
  const { rows } = await pool.query<{
    id: number;
    session_id: string;
    symptoms: string[];
    diagnosis: string;
    confidence: string;
    rules_fired: string[];
    matched_symptoms: string[];
    reasoning: string;
    advice: string;
    created_at: Date;
  }>(
    `SELECT id, session_id, symptoms, diagnosis, confidence,
            rules_fired, matched_symptoms, reasoning, advice, created_at
     FROM diagnoses
     WHERE session_id = $1
     ORDER BY created_at DESC`,
    [sessionId]
  );

  const diagnoses: DiagnosisResponse[] = rows.map((row) => ({
    session_id:         row.session_id,
    diagnosis_id:       row.id,
    diagnosis:          row.diagnosis,
    confidence:         row.confidence as DiagnosisResponse['confidence'],
    rules_fired:        row.rules_fired,
    matched_symptoms:   row.matched_symptoms,
    reasoning:          row.reasoning,
    advice:             row.advice,
    symptoms_submitted: row.symptoms,
    created_at:         row.created_at.toISOString(),
  }));

  return {
    session_id: sessionId,
    count:      diagnoses.length,
    diagnoses,
  };
}

// ---------------------------------------------------------------------------
// getSymptoms
//
// Returns all available symptoms from the catalog, grouped by disease category.
// ---------------------------------------------------------------------------
export async function getSymptoms(): Promise<SymptomsResponse> {
  const { rows } = await pool.query<SymptomCatalogRow>(
    `SELECT id, name, display_name, disease_category
     FROM symptoms_catalog
     ORDER BY disease_category, display_name`
  );

  const categories: SymptomsResponse['categories'] = {};
  const allSymptoms: SymptomsResponse['all_symptoms'] = [];

  for (const row of rows) {
    if (!categories[row.disease_category]) {
      categories[row.disease_category] = [];
    }
    categories[row.disease_category].push({
      name:         row.name,
      display_name: row.display_name,
    });
    allSymptoms.push({
      name:         row.name,
      display_name: row.display_name,
      category:     row.disease_category,
    });
  }

  return { categories, all_symptoms: allSymptoms };
}
