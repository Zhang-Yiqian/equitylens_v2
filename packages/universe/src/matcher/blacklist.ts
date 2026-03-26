import { AI_KEYWORD_CONFIG } from '../config/ai-keywords.js';

// ── Whitelist ───────────────────────────────────────────────────────────────

export const WHITELIST_EXACT = new Set<string>(AI_KEYWORD_CONFIG.whitelistExact);

// ── Blacklist patterns ─────────────────────────────────────────────────────

const PATTERNS: RegExp[] = [
  / Preferred$/i,
  / Preferred Stock$/i,
  / Warrant$/i,
  / Rights$/i,
  / Unit$/i,
  / ETN$/i,
  /^(Corp\.?|Corporation|Inc\.?|Incorporated|Ltd\.?|Limited|LLC|LLP|LP|Co\.?|Company|PLC|SA|AG|Oyj|As|Ab|SpA|Sarl)$/i,
  / ETF$/i,
  / Trust$/i,
  / Fund$/i,
  / Holdings$/i,
  / Investment$/i,
  / Capital$/i,
  / Partners$/i,
  / Resources$/i,
  / Royalty$/i,
  / Income$/i,
  / Dividend$/i,
  / Emerging$/i,
  / Short$/i,
  / Leveraged$/i,
  / Inverse$/i,
  / 2x$/i,
  / 3x$/i,
  /-1x$/i,
  /-2x$/i,
  / BDC$/i,
  / REIT$/i,
  / SPAC$/i,
  / Acquisition$/i,
  / Merger$/i,
  / Bancorp$/i,
  / Banks?$/i,
  / Insurance$/i,
  / Brokerage$/i,
  / Securities$/i,
  / Asset Management$/i,
  / Wealth$/i,
  / Pension$/i,
  / Retirement$/i,
  /hedge fund/i,
  /mutual fund/i,
  /private equity/i,
  /venture capital/i,
  /^(ARCA|NYSE|NASDAQ)\s/i,
  /^(SPY|QQQ|IWM|DIA|ETF|Portfolio|Advantage|Bond|Growth|Value|Index)$/i,
];

/**
 * Returns true if the company name matches a blacklist pattern.
 */
export function isBlacklisted(companyName: string): boolean {
  return PATTERNS.some(p => p.test(companyName));
}

/**
 * Returns true if the ticker is in the AI Core whitelist.
 */
export function isWhitelisted(ticker: string): boolean {
  return WHITELIST_EXACT.has(ticker);
}
