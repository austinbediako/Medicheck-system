/**
 * TypeScript Forward-Chaining Inference Engine
 *
 * Mirrors the logic in prolog/inference_engine.pl exactly.
 * Used automatically when swipl is not available (e.g. Render native runtime).
 * The Prolog files remain the canonical knowledge base definition.
 */

import { PrologResult, ConfidenceLevel } from '../types/index';

// ---------------------------------------------------------------------------
// Knowledge base — mirrors knowledge_base.pl rule/4 and exclusion_rule/2
// ---------------------------------------------------------------------------
interface Rule {
  id: string;
  disease: string;
  confidence: ConfidenceLevel;
  required: string[];
}

const RULES: Rule[] = [
  // Malaria
  { id: 'malaria_high',     disease: 'malaria',   confidence: 'high',     required: ['fever', 'chills', 'headache', 'sweating', 'muscle_pain'] },
  { id: 'malaria_medium',   disease: 'malaria',   confidence: 'medium',   required: ['fever', 'chills', 'nausea', 'vomiting'] },
  { id: 'malaria_possible', disease: 'malaria',   confidence: 'possible', required: ['fever', 'chills', 'sweating', 'headache'] },
  { id: 'malaria_weak',     disease: 'malaria',   confidence: 'possible', required: ['fever', 'chills'] },
  // Diarrhoea
  { id: 'diarrhoea_high',     disease: 'diarrhoea', confidence: 'high',     required: ['loose_stools', 'stomach_cramps', 'dehydration'] },
  { id: 'diarrhoea_medium',   disease: 'diarrhoea', confidence: 'medium',   required: ['loose_stools', 'abdominal_pain', 'nausea'] },
  { id: 'diarrhoea_possible', disease: 'diarrhoea', confidence: 'possible', required: ['loose_stools', 'loss_of_appetite', 'bloating'] },
  { id: 'diarrhoea_weak',     disease: 'diarrhoea', confidence: 'possible', required: ['loose_stools', 'stomach_cramps'] },
  { id: 'diarrhoea_weak2',    disease: 'diarrhoea', confidence: 'possible', required: ['loose_stools', 'mild_fever'] },
  // HIV/AIDS
  { id: 'hiv_high',     disease: 'HIV/AIDS', confidence: 'high',     required: ['weight_loss', 'persistent_fatigue', 'night_sweats', 'swollen_lymph_nodes'] },
  { id: 'hiv_medium',   disease: 'HIV/AIDS', confidence: 'medium',   required: ['recurring_fever', 'persistent_fatigue', 'swollen_lymph_nodes', 'weight_loss'] },
  { id: 'hiv_possible', disease: 'HIV/AIDS', confidence: 'possible', required: ['oral_thrush', 'weight_loss', 'night_sweats'] },
  { id: 'hiv_weak',     disease: 'HIV/AIDS', confidence: 'possible', required: ['persistent_fatigue', 'weight_loss'] },
  { id: 'hiv_weak2',    disease: 'HIV/AIDS', confidence: 'possible', required: ['night_sweats', 'persistent_fatigue'] },
];

// Gatekeeper exclusions — mirrors exclusion_rule/2
const SYMPTOM_EXCLUSIONS: Record<string, string> = {
  malaria:   'chills',
  diarrhoea: 'loose_stools',
};

// Advice — mirrors advice/2
const ADVICE: Record<string, string> = {
  'malaria-high':     'Seek immediate medical attention. A blood smear or RDT test is required to confirm Malaria. Do not self-medicate with antimalarials without laboratory confirmation.',
  'malaria-medium':   'Consult a doctor promptly. Your symptoms are consistent with Malaria. A rapid diagnostic test (RDT) is recommended.',
  'malaria-possible': 'Monitor symptoms closely. Possible Malaria — confirm with a blood test. Seek medical care if symptoms worsen or persist beyond 24 hours.',
  'diarrhoea-high':     'Stay hydrated with oral rehydration salts (ORS). Seek medical attention if dehydration is severe, symptoms persist beyond 48 hours, or blood appears in stools.',
  'diarrhoea-medium':   'Rest and increase fluid intake. Eat bland foods. Consult a doctor if symptoms worsen or do not improve within 48 hours.',
  'diarrhoea-possible': 'Possible Diarrhoea — monitor hydration carefully. Avoid dairy and fatty foods. Seek medical advice if symptoms escalate.',
  'HIV/AIDS-high':     'URGENT: Please refer for HIV testing immediately. These symptoms are strongly associated with HIV/AIDS. Early diagnosis is critical for effective treatment and care.',
  'HIV/AIDS-medium':   'These symptoms may indicate HIV/AIDS. An HIV test is strongly recommended. Consult a healthcare provider as soon as possible.',
  'HIV/AIDS-possible': 'Possible HIV/AIDS indicators detected. An HIV test is recommended. Speak confidentially with a healthcare provider.',
};

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { high: 3, medium: 2, possible: 1, none: 0 };

// ---------------------------------------------------------------------------
// Forward chaining engine — mirrors inference_engine.pl diagnose/3
// ---------------------------------------------------------------------------
export function runTsInference(symptoms: string[], duration: string): PrologResult {
  const symptomSet = new Set(symptoms);

  // Phase 1 — apply exclusion rules
  const excluded = new Set<string>();
  for (const [disease, gatekeeper] of Object.entries(SYMPTOM_EXCLUSIONS)) {
    if (!symptomSet.has(gatekeeper)) excluded.add(disease);
  }
  if (duration === 'less_than_2_weeks') excluded.add('HIV/AIDS');

  // Phase 2 — forward chaining: fire all rules whose conditions are met
  const firedRules = RULES.filter(
    (rule) => !excluded.has(rule.disease) && rule.required.every((s) => symptomSet.has(s)),
  );

  // Fallback
  if (firedRules.length === 0) {
    return {
      diagnosis:        'Unable to determine diagnosis',
      confidence:       'none',
      rules_fired:      [],
      matched_symptoms: [],
      reasoning:        'No diagnostic rules could be matched to the reported symptoms. Please consult a medical professional for a proper evaluation.',
      advice:           'Unable to make a diagnosis based on the provided symptoms. Please consult a qualified medical professional.',
      error:            null,
    };
  }

  // Phase 3 — select best confidence: high > medium > possible
  const bestRank = Math.max(...firedRules.map((r) => CONFIDENCE_RANK[r.confidence]));
  const bestConfidence = (Object.keys(CONFIDENCE_RANK) as ConfidenceLevel[]).find(
    (k) => CONFIDENCE_RANK[k] === bestRank,
  )!;

  // Among best-confidence rules, pick the disease with the most matched symptoms
  const topRules = firedRules.filter((r) => r.confidence === bestConfidence);
  const diseaseScores = new Map<string, number>();
  for (const rule of topRules) {
    const matched = rule.required.filter((s) => symptomSet.has(s)).length;
    diseaseScores.set(rule.disease, Math.max(diseaseScores.get(rule.disease) ?? 0, matched));
  }
  const disease = [...diseaseScores.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const diseaseRules = topRules.filter((r) => r.disease === disease);
  const matchedSymptoms = [
    ...new Set(diseaseRules.flatMap((r) => r.required.filter((s) => symptomSet.has(s)))),
  ];
  const ruleIds = diseaseRules.map((r) => r.id);

  // Phase 4 — build reasoning chain string (mirrors build_reasoning/5)
  const steps = diseaseRules
    .map((r) => {
      const present = r.required.filter((s) => symptomSet.has(s)).join(', ');
      return `[Rule ${r.id} fired: (${present}) → ${disease} (${bestConfidence.toUpperCase()}).]`;
    })
    .join(' ');
  const reasoning = `Forward chaining inference initiated with ${symptoms.length} reported symptom(s). ${steps} Conclusion: ${disease} diagnosed with ${bestConfidence.toUpperCase()} confidence.`;

  return {
    diagnosis:        disease,
    confidence:       bestConfidence,
    rules_fired:      ruleIds,
    matched_symptoms: matchedSymptoms,
    reasoning,
    advice:           ADVICE[`${disease}-${bestConfidence}`] ?? '',
    error:            null,
  };
}
