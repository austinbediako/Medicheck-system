/**
 * TypeScript Forward-Chaining Inference Engine
 *
 * Mirrors the logic in prolog/inference_engine.pl exactly.
 * Used automatically when swipl is not available (e.g. Render native runtime).
 * The Prolog files remain the canonical knowledge base definition.
 */
import { PrologResult } from '../types/index';
export declare function runTsInference(symptoms: string[], duration: string): PrologResult;
//# sourceMappingURL=tsInferenceEngine.d.ts.map