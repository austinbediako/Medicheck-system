import { DiagnosisRequest, DiagnosisResponse, HistoryResponse, SymptomsResponse } from '../types/index';
export declare function runDiagnosis(req: DiagnosisRequest): Promise<DiagnosisResponse>;
export declare function getHistory(sessionId: string): Promise<HistoryResponse>;
export declare function getSymptoms(): Promise<SymptomsResponse>;
//# sourceMappingURL=diagnosisService.d.ts.map