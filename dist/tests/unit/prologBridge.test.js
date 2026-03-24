"use strict";
// =============================================================================
// MediCheck — Unit Tests: prologBridge.ts
//
// Tests the Node ↔ SWI-Prolog IPC layer in isolation.
// `child_process.spawn` is fully mocked — no real swipl process is started.
//
// Coverage targets
//   ✓ Correct CLI arguments are passed to swipl
//   ✓ JSON is extracted from clean stdout
//   ✓ JSON is extracted when Prolog warnings precede the result line
//   ✓ Default symptom duration fallback
//   ✓ Non-zero exit with stdout still parses (Prolog warning path)
//   ✓ All rejection paths: no-stdout exit, no JSON, bad JSON, error field, timeout, ENOENT, generic error
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const prologBridge_1 = require("../../services/prologBridge");
const mockFactory_1 = require("../helpers/mockFactory");
// ---------------------------------------------------------------------------
// Module-level mock — replaces the real `spawn` with a jest.fn()
// ---------------------------------------------------------------------------
jest.mock('child_process');
const mockSpawn = child_process_1.spawn;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Wraps createMockProcess + mockSpawn.mockReturnValue in one call. */
function setupMockProcess() {
    const proc = (0, mockFactory_1.createMockProcess)();
    mockSpawn.mockReturnValue(proc);
    return proc;
}
// =============================================================================
// Test suite
// =============================================================================
describe('prologBridge — runPrologInference()', () => {
    // --------------------------------------------------------------------------
    // 1. Successful inference paths
    // --------------------------------------------------------------------------
    describe('successful inference', () => {
        it('resolves with the parsed PrologResult when stdout contains clean JSON', async () => {
            const expected = (0, mockFactory_1.makePrologResult)();
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify(expected), 0);
            const result = await (0, prologBridge_1.runPrologInference)(['fever', 'chills', 'headache'], 'unknown');
            expect(result.diagnosis).toBe('malaria');
            expect(result.confidence).toBe('high');
            expect(result.rules_fired).toEqual(['malaria_high']);
            expect(result.matched_symptoms).toContain('fever');
            expect(result.error).toBeNull();
        });
        it('extracts the JSON line even when Prolog prints warnings before it', async () => {
            const expected = (0, mockFactory_1.makePrologResult)({ diagnosis: 'diarrhoea', confidence: 'high' });
            // Simulate typical SWI-Prolog boot output followed by the result JSON
            const stdoutWithWarnings = [
                'Welcome to SWI-Prolog (threaded, 64 bits)',
                'WARNING: /some/path.pl:12: Singleton variables: [X]',
                'INFO: Loading knowledge base...',
                JSON.stringify(expected), // ← this is the line that must be found
            ].join('\n');
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, stdoutWithWarnings, 0);
            const result = await (0, prologBridge_1.runPrologInference)(['loose_stools'], 'unknown');
            expect(result.diagnosis).toBe('diarrhoea');
            expect(result.confidence).toBe('high');
        });
        it('picks the LAST JSON-looking line when multiple JSON fragments appear in stdout', async () => {
            const first = JSON.stringify((0, mockFactory_1.makePrologResult)({ diagnosis: 'diarrhoea', confidence: 'medium' }));
            const second = JSON.stringify((0, mockFactory_1.makePrologResult)({ diagnosis: 'malaria', confidence: 'high' }));
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, `${first}\n${second}\n`, 0);
            const result = await (0, prologBridge_1.runPrologInference)(['fever'], 'unknown');
            // extractLastJsonLine scans from the bottom, so second line wins
            expect(result.diagnosis).toBe('malaria');
        });
        it('uses "unknown" as the default symptom_duration when the argument is omitted', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['fever']);
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.arrayContaining(['--duration', 'unknown']), expect.any(Object));
        });
        it('passes the correct --symptoms comma-separated string to swipl', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['fever', 'chills', 'headache'], 'unknown');
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.arrayContaining(['--symptoms', 'fever,chills,headache']), expect.any(Object));
        });
        it('passes the supplied symptom_duration to swipl', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['fever'], 'more_than_2_weeks');
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.arrayContaining(['--duration', 'more_than_2_weeks']), expect.any(Object));
        });
        it('still resolves when swipl exits with non-zero code but stdout has valid JSON', async () => {
            // Non-zero exit can happen when Prolog emits warnings; as long as stdout
            // contains parseable JSON the bridge should succeed.
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 1 /* non-zero */);
            const result = await (0, prologBridge_1.runPrologInference)(['fever'], 'unknown');
            expect(result.diagnosis).toBe('malaria');
        });
        it('resolves without rejecting when error field is the string "null"', async () => {
            // The Prolog bridge may emit error: "null" (a string) instead of a real
            // JSON null.  The bridge code explicitly allows this.
            const prologResultWithStringNull = (0, mockFactory_1.makePrologResult)({ error: 'null' });
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify(prologResultWithStringNull), 0);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown')).resolves.toBeDefined();
        });
        it('resolves with the fallback result when Prolog fires no rules', async () => {
            const fallback = (0, mockFactory_1.makeFallbackPrologResult)();
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify(fallback), 0);
            const result = await (0, prologBridge_1.runPrologInference)(['bloating'], 'unknown');
            expect(result.diagnosis).toBe('Unable to determine diagnosis');
            expect(result.confidence).toBe('none');
            expect(result.rules_fired).toHaveLength(0);
        });
        it('invokes swipl with the correct base arguments (-g main -t halt)', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['fever'], 'unknown');
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.arrayContaining(['-g', 'main', '-t', 'halt']), expect.any(Object));
        });
    });
    // --------------------------------------------------------------------------
    // 2. Failure / rejection paths
    // --------------------------------------------------------------------------
    describe('failure scenarios', () => {
        it('rejects when swipl exits non-zero with empty stdout (stderr used as message)', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, '' /* empty stdout */, 1, 'ERROR: Unknown procedure: main/0');
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('Prolog process failed: ERROR: Unknown procedure: main/0');
        });
        it('includes a generic exit-code message when both stdout and stderr are empty', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, '', 2, '' /* also empty stderr */);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('swipl exited with code 2');
        });
        it('rejects when stdout contains no JSON object at all', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, 'Loading knowledge base... done.\nAll rules checked.\n', 0);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('No JSON output from Prolog');
        });
        it('rejects when the JSON line is syntactically malformed', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, '{ diagnosis: malaria, confidence: high }' /* invalid JSON */, 0);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('Failed to parse Prolog JSON output');
        });
        it('rejects when the parsed result contains a non-null error field', async () => {
            const errorResult = (0, mockFactory_1.makePrologResult)({
                error: 'Missing required argument: --symptoms',
            });
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify(errorResult), 0);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('Prolog inference error: Missing required argument: --symptoms');
        });
        it('rejects with an install-hint message when swipl is not on PATH (ENOENT)', async () => {
            const proc = setupMockProcess();
            const enoent = Object.assign(new Error('spawn swipl ENOENT'), { code: 'ENOENT' });
            (0, mockFactory_1.simulatePrologError)(proc, enoent);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('SWI-Prolog (swipl) not found');
        });
        it('rejects with a generic message for non-ENOENT spawn errors', async () => {
            const proc = setupMockProcess();
            const genericError = new Error('EACCES: permission denied, spawn swipl');
            (0, mockFactory_1.simulatePrologError)(proc, genericError);
            await expect((0, prologBridge_1.runPrologInference)(['fever'], 'unknown'))
                .rejects.toThrow('Failed to spawn swipl: EACCES: permission denied, spawn swipl');
        });
        it('rejects and kills the process after PROLOG_TIMEOUT_MS (15 s)', async () => {
            jest.useFakeTimers();
            const proc = setupMockProcess();
            // Intentionally do NOT emit 'close' — the process hangs forever
            const promise = (0, prologBridge_1.runPrologInference)(['fever'], 'unknown');
            // Advance past the 15-second guard timeout
            jest.advanceTimersByTime(15001);
            await expect(promise).rejects.toThrow('timed out after 15000ms');
            expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
        });
    });
    // --------------------------------------------------------------------------
    // 3. Argument / edge-case variations
    // --------------------------------------------------------------------------
    describe('argument edge cases', () => {
        it('passes a single symptom without a trailing comma', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['fever'], 'unknown');
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.arrayContaining(['--symptoms', 'fever']), expect.any(Object));
        });
        it('passes less_than_2_weeks duration correctly', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makeFallbackPrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['weight_loss', 'night_sweats'], 'less_than_2_weeks');
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.arrayContaining(['--duration', 'less_than_2_weeks']), expect.any(Object));
        });
        it('spawns with stdio configuration ignoring stdin and piping stdout/stderr', async () => {
            const proc = setupMockProcess();
            (0, mockFactory_1.simulateProlog)(proc, JSON.stringify((0, mockFactory_1.makePrologResult)()), 0);
            await (0, prologBridge_1.runPrologInference)(['fever'], 'unknown');
            expect(mockSpawn).toHaveBeenCalledWith('swipl', expect.any(Array), expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }));
        });
    });
});
//# sourceMappingURL=prologBridge.test.js.map