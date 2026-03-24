"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPrologInference = runPrologInference;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const tsInferenceEngine_1 = require("./tsInferenceEngine");
// Path to bridge.pl relative to project root
const BRIDGE_PL = path_1.default.resolve(__dirname, "../../prolog/bridge.pl");
// How long (ms) to wait for SWI-Prolog before timing out
const PROLOG_TIMEOUT_MS = 15000;
// Allow the swipl executable path to be overridden via environment variable.
// This is useful on Windows where swipl may not be on the shell PATH but is
// installed at a known location (e.g. C:\Program Files\swipl\bin\swipl.exe).
// Read at CALL TIME (inside the function) so that any code which sets
// process.env.SWIPL_EXECUTABLE before the first spawn — including the
// expert-system test setup — is always picked up correctly.
function getSwiplCmd() {
    return process.env.SWIPL_EXECUTABLE || "swipl";
}
/**
 * runPrologInference
 *
 * Spawns a SWI-Prolog subprocess with bridge.pl, passes the symptom list
 * and duration as CLI arguments, and parses the JSON written to stdout.
 *
 * Forward chaining inference happens entirely inside Prolog; this function
 * is purely the Node ↔ Prolog IPC layer.
 */
async function runPrologInference(symptoms, symptomDuration = "unknown") {
    return new Promise((resolve, reject) => {
        const symptomsStr = symptoms.join(",");
        // Spawn SWI-Prolog:
        //   swipl -g main -t halt bridge.pl -- --symptoms "..." --duration "..."
        const swiplCmd = getSwiplCmd();
        const proc = (0, child_process_1.spawn)(swiplCmd, [
            "-g",
            "main",
            "-t",
            "halt",
            BRIDGE_PL,
            "--",
            "--symptoms",
            symptomsStr,
            "--duration",
            symptomDuration,
        ], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        // Timeout guard
        const timer = setTimeout(() => {
            proc.kill("SIGKILL");
            reject(new Error(`Prolog inference timed out after ${PROLOG_TIMEOUT_MS}ms`));
        }, PROLOG_TIMEOUT_MS);
        proc.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0 && !stdout.trim()) {
                const errMsg = stderr.trim() || `swipl exited with code ${code}`;
                return reject(new Error(`Prolog process failed: ${errMsg}`));
            }
            // Extract the last JSON object from stdout (Prolog may emit warnings before it)
            const jsonLine = extractLastJsonLine(stdout);
            if (!jsonLine) {
                return reject(new Error(`No JSON output from Prolog.\nstdout: ${stdout}\nstderr: ${stderr}`));
            }
            try {
                const result = JSON.parse(jsonLine);
                if (result.error !== null && result.error !== "null" && result.error) {
                    return reject(new Error(`Prolog inference error: ${result.error}`));
                }
                resolve(result);
            }
            catch (parseErr) {
                reject(new Error(`Failed to parse Prolog JSON output: ${jsonLine}\nParse error: ${String(parseErr)}`));
            }
        });
        proc.on("error", (err) => {
            clearTimeout(timer);
            if (err.code === "ENOENT") {
                // swipl not installed — fall back to built-in TypeScript inference engine
                console.warn("[MediCheck] swipl not found — using TypeScript inference engine fallback.");
                try {
                    resolve((0, tsInferenceEngine_1.runTsInference)(symptoms, symptomDuration));
                }
                catch (tsErr) {
                    reject(tsErr);
                }
            }
            else {
                reject(new Error(`Failed to spawn swipl: ${err.message}`));
            }
        });
    });
}
/**
 * extractLastJsonLine
 *
 * Scans stdout lines from the bottom up and returns the first line
 * that looks like a complete JSON object. This tolerates Prolog printing
 * informational warnings or trace output before the result.
 */
function extractLastJsonLine(output) {
    const lines = output.split("\n").reverse();
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            return trimmed;
        }
    }
    return null;
}
//# sourceMappingURL=prologBridge.js.map