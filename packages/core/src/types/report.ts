export interface Report {
  analysisId?: number;
  ticker: string;
  year: number;
  quarter: number;
  markdownContent: string;
  filePath: string;
  generatedAt: string;
}
