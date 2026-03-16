export interface TickerInfo {
  ticker: string;
  name: string;
  sector: string;
  node: string;
}

export const MVP_TICKERS: TickerInfo[] = [
  // AI 应用与变现层
  { ticker: 'APP', name: 'AppLovin', sector: 'Software', node: 'AI SaaS/Platform' },
  { ticker: 'PLTR', name: 'Palantir Technologies', sector: 'Software', node: 'AI SaaS/Platform' },
  { ticker: 'CRWD', name: 'CrowdStrike', sector: 'Software', node: 'AI SaaS/Platform' },

  // AI 能源与基建层
  { ticker: 'CEG', name: 'Constellation Energy', sector: 'Energy', node: 'Data Center Infrastructure' },
  { ticker: 'VST', name: 'Vistra Corp', sector: 'Energy', node: 'Data Center Infrastructure' },
  { ticker: 'ASTS', name: 'AST SpaceMobile', sector: 'Communications', node: 'Networking/Custom Silicon' },

  // 光通信与互联层
  { ticker: 'LITE', name: 'Lumentum', sector: 'Semiconductors', node: 'Networking/Custom Silicon' },
  { ticker: 'CIEN', name: 'Ciena', sector: 'Networking', node: 'Networking/Custom Silicon' },

  // 硬件与高速存储层
  { ticker: 'WDC', name: 'Western Digital', sector: 'Semiconductors', node: 'Memory/Storage' },
  { ticker: 'MU', name: 'Micron Technology', sector: 'Semiconductors', node: 'Memory/Storage' },
];

export const MVP_TICKER_SET = new Set(MVP_TICKERS.map(t => t.ticker));
