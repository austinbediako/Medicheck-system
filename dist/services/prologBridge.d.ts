import { PrologResult } from "../types/index";
/**
 * runPrologInference
 *
 * Spawns a SWI-Prolog subprocess with bridge.pl, passes the symptom list
 * and duration as CLI arguments, and parses the JSON written to stdout.
 *
 * Forward chaining inference happens entirely inside Prolog; this function
 * is purely the Node ↔ Prolog IPC layer.
 */
export declare function runPrologInference(symptoms: string[], symptomDuration?: string): Promise<PrologResult>;
//# sourceMappingURL=prologBridge.d.ts.map