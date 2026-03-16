import type { FinancialSnapshot } from './types/financial.js';
import type { InflectionAnalysis } from './types/analysis.js';
import type { Report } from './types/report.js';

export interface PipelineInput {
  ticker: string;
  year: number;
  quarter: number;
  modelKey?: string;
  forceRefresh?: boolean;
}

export interface PipelineOutput {
  financial: FinancialSnapshot;
  analysis: InflectionAnalysis;
  report: Report;
  validation: {
    totalEvidence: number;
    verifiedCount: number;
    failedCount: number;
  };
}

export type PipelineStage = 'fetch' | 'analyze' | 'validate' | 'report';

export interface PipelineProgress {
  stage: PipelineStage;
  message: string;
  pct: number;
}
