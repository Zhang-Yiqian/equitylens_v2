export interface TickerInfo {
  ticker: string;
  name: string;
  sector: string;
  node: string;
}

export const MVP_TICKERS: TickerInfo[] = [
  { ticker: 'NVDA', name: 'NVIDIA', sector: 'Semiconductors', node: 'GPU/Accelerators' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors', node: 'GPU/Accelerators' },
  { ticker: 'AVGO', name: 'Broadcom', sector: 'Semiconductors', node: 'Networking/Custom Silicon' },
  { ticker: 'MU', name: 'Micron Technology', sector: 'Semiconductors', node: 'Memory/Storage' },
  { ticker: 'MSFT', name: 'Microsoft', sector: 'Cloud/Software', node: 'Cloud Infrastructure' },
  { ticker: 'GOOGL', name: 'Alphabet', sector: 'Cloud/Software', node: 'Cloud/LLM Platform' },
  { ticker: 'AMZN', name: 'Amazon', sector: 'Cloud/Software', node: 'Cloud Infrastructure' },
  { ticker: 'PLTR', name: 'Palantir Technologies', sector: 'Software', node: 'AI SaaS/Platform' },
  { ticker: 'SMCI', name: 'Super Micro Computer', sector: 'Hardware', node: 'Servers/OEM' },
  { ticker: 'VRT', name: 'Vertiv Holdings', sector: 'Infrastructure', node: 'Data Center Infrastructure' },
];

export const MVP_TICKER_SET = new Set(MVP_TICKERS.map(t => t.ticker));
