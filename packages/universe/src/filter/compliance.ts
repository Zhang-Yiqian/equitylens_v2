import { SecEdgarClient, fetch10KData } from '@equitylens/data';
import type { ComplianceResult, BlacklistReason } from '@equitylens/core';

// Going concern patterns
const GOING_CONCERN_PATTERNS = [
  /going\s+concern/i,
  /substantial\s+doubt/i,
  /doubt\s+about\s+its\s+ability\s+to\s+continue/i,
  /liquidity\s+risk/i,
  /may\s+not\s+be\s+able\s+to\s+continue\s+as\s+a\s+going\s+concern/i,
  /ability\s+to\s+continue\s+as\s+a\s+going\s+concern/i,
  /raises\s+substantial\s+doubt/i,
  /recurring\s+losses?\s+from\s+operations/i,
  /negative\s+working\s+capital/i,
  /default\s+on\s+debt\s+agreements/i,
];

// Auditor resignation patterns
const AUDITOR_RESIGNATION_PATTERNS = [
  /(auditor|accountant)\w*\s+resign/i,
  /resign\w*\s+(as|by|from)\s+(our|the)\s+auditor/i,
  /dismissed\s+(the\s+)?auditor/i,
  /discharged\w*\s+(the\s+)?auditor/i,
  /auditor\w*\s+(was\s+)?(dismissed|discharged|terminated)/i,
  /new\s+(independent\s+)?auditor/i,
  /engag(e|ed|ing)\s+(a\s+new\s+)?auditor/i,
];

function checkText(text: string): { goingConcern: boolean; auditorResignation: boolean; matchedPatterns: string[] } {
  const matched: string[] = [];

  for (const pattern of GOING_CONCERN_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(`going_concern:${pattern.source}`);
    }
  }

  for (const pattern of AUDITOR_RESIGNATION_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(`auditor_resignation:${pattern.source}`);
    }
  }

  return {
    goingConcern: matched.some(m => m.startsWith('going_concern:')),
    auditorResignation: matched.some(m => m.startsWith('auditor_resignation:')),
    matchedPatterns: matched,
  };
}

/**
 * Check compliance (going concern + auditor resignation) for a list of tickers.
 * Returns ComplianceResult[] and a map of tickers that should be blacklisted.
 */
export async function checkCompliance(
  tickers: string[],
  options?: {
    signal?: AbortSignal;
    verbose?: boolean;
    userAgent?: string;
  },
): Promise<{ results: ComplianceResult[]; blacklist: Map<string, { reason: BlacklistReason; pattern: string }> }> {
  const results: ComplianceResult[] = [];
  const blacklist = new Map<string, { reason: BlacklistReason; pattern: string }>();
  const secClient = new SecEdgarClient(options?.userAgent);

  if (options?.verbose) {
    console.log(`\n🏛️  Compliance Check: ${tickers.length} tickers...`);
  }

  for (const ticker of tickers) {
    if (options?.signal?.aborted) break;

    try {
      const tenK = await fetch10KData(secClient, ticker);

      if (!tenK) {
        results.push({
          ticker,
          hasGoingConcern: false,
          hasAuditorResignation: false,
          matchedPatterns: [],
          checkedAt: new Date().toISOString(),
        });
        continue;
      }

      // Combine Item 1 (Business) and Item 1A (Risk Factors) for checking
      const combined = [
        tenK.item1Business ?? '',
        tenK.item1ARiskFactors ?? '',
      ].join('\n');

      const { goingConcern, auditorResignation, matchedPatterns } = checkText(combined);

      if (goingConcern) {
        blacklist.set(ticker, { reason: 'compliance_going_concern', pattern: matchedPatterns.join(', ') });
      }
      if (auditorResignation) {
        blacklist.set(ticker, { reason: 'compliance_auditor_resignation', pattern: matchedPatterns.join(', ') });
      }

      results.push({
        ticker,
        hasGoingConcern: goingConcern,
        hasAuditorResignation: auditorResignation,
        matchedPatterns,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      // On error (no 10-K found, network issue), skip compliance check
      results.push({
        ticker,
        hasGoingConcern: false,
        hasAuditorResignation: false,
        matchedPatterns: [],
        checkedAt: new Date().toISOString(),
      });
    }
  }

  if (options?.verbose) {
    console.log(`  ✅ Compliance check: ${blacklist.size} flagged for blacklist`);
  }

  return { results, blacklist };
}
