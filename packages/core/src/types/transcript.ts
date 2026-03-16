export interface EarningsTranscript {
  ticker: string;
  year: number;
  quarter: number;
  content: string;
  wordCount: number;
  fetchedAt: string;
}

export interface TranscriptSection {
  type: 'prepared_remarks' | 'qa' | 'operator' | 'safe_harbor' | 'other';
  speaker?: string;
  title?: string;
  content: string;
}
