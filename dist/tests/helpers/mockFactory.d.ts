import { EventEmitter } from 'events';
import type { PrologResult, DiagnosisResponse, SymptomCatalogRow } from '../../types/index';
/**
 * Typed representation of the mock child process returned by our spawn mock.
 * Mirrors the subset of ChildProcess that prologBridge.ts actually uses.
 */
export interface MockChildProcess extends EventEmitter {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
}
/**
 * Creates a fresh mock child process with EventEmitter-based stdout/stderr.
 * Pass the return value of this to `(spawn as jest.Mock).mockReturnValue(proc)`.
 */
export declare function createMockProcess(): MockChildProcess;
/**
 * Simulates a Prolog subprocess completing successfully (or with a given exit
 * code).  Events are emitted in a resolved-Promise microtask so that the
 * caller's `.on('close', ...)` handler is always registered first.
 *
 * @param proc      The mock process created by `createMockProcess`.
 * @param stdout    Text to emit on proc.stdout before closing.
 * @param exitCode  Value passed to the 'close' event (default 0).
 * @param stderr    Optional text to emit on proc.stderr.
 */
export declare function simulateProlog(proc: MockChildProcess, stdout: string, exitCode?: number, stderr?: string): void;
/**
 * Simulates the 'error' event on a mock process (e.g. ENOENT when swipl is
 * not installed, or a generic spawn failure).
 */
export declare function simulatePrologError(proc: MockChildProcess, error: Error): void;
/**
 * Returns a valid PrologResult object.  Override any field you need to change.
 * Defaults to a HIGH-confidence malaria diagnosis.
 */
export declare function makePrologResult(overrides?: Partial<PrologResult>): PrologResult;
/** Convenience wrapper — returns the canonical "no rules fired" fallback result. */
export declare function makeFallbackPrologResult(): PrologResult;
/** Returns a PrologResult for a diarrhoea HIGH diagnosis. */
export declare function makeDiarrhoeaPrologResult(overrides?: Partial<PrologResult>): PrologResult;
/** Returns a PrologResult for an HIV/AIDS HIGH diagnosis. */
export declare function makeHivPrologResult(overrides?: Partial<PrologResult>): PrologResult;
/**
 * Returns a valid DiagnosisResponse (as returned by the API).
 * Override any field you need.
 */
export declare function makeDiagnosisResponse(overrides?: Partial<DiagnosisResponse>): DiagnosisResponse;
/**
 * Mimics a raw row returned by pg for a SELECT on the `diagnoses` table.
 * `created_at` is a real Date so that `.toISOString()` works correctly.
 */
export declare function makeDbDiagnosisRow(overrides?: Partial<{
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
}>): {
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
};
/**
 * Mimics a raw row returned by pg for a SELECT on `symptoms_catalog`.
 */
export declare function makeSymptomCatalogRow(overrides?: Partial<SymptomCatalogRow>): SymptomCatalogRow;
/**
 * Builds the full set of 22 symptom catalog rows that match the seeded schema,
 * useful for testing `getSymptoms()` grouping logic end-to-end.
 */
export declare function makeFullSymptomCatalog(): SymptomCatalogRow[];
//# sourceMappingURL=mockFactory.d.ts.map