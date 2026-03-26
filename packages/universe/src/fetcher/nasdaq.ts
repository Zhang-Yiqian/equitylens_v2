import type { NasdaqMarket, UniverseSource } from '@equitylens/core';
import https from 'node:https';

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

export interface NasdaqRow {
  symbol: string;
  companyName: string;
  market: NasdaqMarket | null;
  testIssue: boolean;
  source: UniverseSource;
}

const BLACKLIST_SUFFIXES = [
  /\bETF$/i,
  /\bTrust$/i,
  /\bFund$/i,
  /\bIndex$/i,
  /\bPortfolio$/i,
  /\bHoldings$/i,
  /\bCapital$/i,
  /\bInvestment$/i,
  /\bPartners$/i,
  /\bResources$/i,
  /\bRoyalty$/i,
  /\bIncome$/i,
  /\bDividend$/i,
  /\bWarrant$/i,
  /\bRights$/i,
  /\bUnit$/i,
  /\bBDC$/i,
  /\bREIT$/i,
  /\bSPAC$/i,
  /\bAcquisition$/i,
  /\bMerger$/i,
  /\bShort$/i,
  /\bLeveraged$/i,
  /\bInverse$/i,
];

const BLACKLIST_KEYWORDS = [
  'hedge fund', 'mutual fund', 'private equity', 'venture capital',
  'asset management', 'wealth management', 'pension fund',
];

function isBlacklistedName(name: string): boolean {
  const lower = name.toLowerCase();
  for (const pattern of BLACKLIST_SUFFIXES) {
    if (pattern.test(name)) return true;
  }
  for (const kw of BLACKLIST_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

function parseNasdaqListed(content: string): NasdaqRow[] {
  const lines = content.split('\n');
  const rows: NasdaqRow[] = [];

  for (const line of lines) {
    if (!line.trim() || line.startsWith('Symbol') || line.includes('File Creation Time')) continue;
    const parts = line.split('|');
    if (parts.length < 2) continue;

    const symbol = parts[0]?.trim() ?? '';
    const companyName = parts[1]?.trim() ?? '';
    const market = parts[2]?.trim() as NasdaqMarket | undefined;
    const testIssue = parts[5]?.trim() === 'Y';

    if (!symbol || !companyName) continue;

    rows.push({
      symbol,
      companyName,
      market: market ?? null,
      testIssue,
      source: 'nasdaq_listed',
    });
  }

  return rows;
}

function parseOtherListed(content: string): NasdaqRow[] {
  const lines = content.split('\n');
  const rows: NasdaqRow[] = [];

  for (const line of lines) {
    if (!line.trim() || line.startsWith('ACT Symbol') || line.includes('File Creation Time')) continue;
    const parts = line.split('|');
    if (parts.length < 2) continue;

    const symbol = parts[0]?.trim() ?? '';
    const companyName = parts[1]?.trim() ?? '';
    const exchange = parts[2]?.trim() ?? '';

    if (!symbol || !companyName) continue;

    rows.push({
      symbol,
      companyName,
      market: exchange === 'NASDAQ' ? 'NASDAQ Capital Market' : null,
      testIssue: false,
      source: 'nasdaq_other',
    });
  }

  return rows;
}

/**
 * Fetch and parse the full Nasdaq Trader Symbol Directory.
 * Downloads both nasdaqlisted.txt and otherlisted.txt concurrently.
 * Filters out ETFs, funds, trusts, warrants, and test issues.
 */
export async function fetchNasdaqUniverse(options?: {
  noCache?: boolean;
  signal?: AbortSignal;
}): Promise<NasdaqRow[]> {
  const controller = new AbortController();
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  const [listedText, otherText] = await Promise.all([
    httpsGet('https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt'),
    httpsGet('https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt'),
  ]);

  const listed = parseNasdaqListed(listedText);
  const other = parseOtherListed(otherText);

  const all = [...listed, ...other];

  // De-duplicate by symbol (prefer nasdaq_listed source)
  const seen = new Map<string, NasdaqRow>();
  for (const row of all) {
    if (!seen.has(row.symbol)) {
      seen.set(row.symbol, row);
    }
  }

  const result: NasdaqRow[] = [];
  for (const row of seen.values()) {
    // Skip test issues
    if (row.testIssue) continue;
    // Skip blacklisted names
    if (isBlacklistedName(row.companyName)) continue;
    result.push(row);
  }

  return result;
}
