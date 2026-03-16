import type { InflectionAnalysis, CrossValidationAnalysis, Evidence } from '@equitylens/core';

interface ValidationResult {
  isValid: boolean;
  totalEvidence: number;
  verifiedCount: number;
  failedCount: number;
  skippedCount: number;
  failures: Array<{
    dimensionId: string;
    quote: string;
    reason: string;
  }>;
}

interface MultiSourceTexts {
  financialText: string;
  tenKText?: string;
  newsText?: string;
}

/**
 * Validate evidence citations for cross-validation analysis.
 * Routes each evidence item to the appropriate source text based on evidence.source.
 */
export function validateCrossEvidence(
  analysis: CrossValidationAnalysis,
  sources: MultiSourceTexts,
): ValidationResult {
  const financialLower = sources.financialText.toLowerCase();
  const tenKLower = (sources.tenKText ?? '').toLowerCase();
  const newsLower = (sources.newsText ?? '').toLowerCase();

  const getSourceText = (ev: Evidence): string => {
    if (ev.source === '10k') return tenKLower;
    if (ev.source === 'news') return newsLower;
    return financialLower; // 'financial' | 'transcript' | default
  };

  const failures: ValidationResult['failures'] = [];
  let totalEvidence = 0;
  let verifiedCount = 0;
  let skippedCount = 0;

  for (const dim of analysis.dimensions) {
    if (dim.signal === 'skipped') { skippedCount++; continue; }
    for (const ev of dim.evidence) {
      totalEvidence++;
      const result = verifyQuote(ev, getSourceText(ev));
      if (result.verified) verifiedCount++;
      else failures.push({ dimensionId: dim.id, quote: ev.quote.substring(0, 100), reason: result.reason });
    }
  }

  for (const cat of analysis.catalysts) {
    for (const ev of cat.evidence) {
      totalEvidence++;
      const result = verifyQuote(ev, getSourceText(ev));
      if (result.verified) verifiedCount++;
      else failures.push({ dimensionId: 'catalyst', quote: ev.quote.substring(0, 100), reason: result.reason });
    }
  }

  for (const risk of analysis.risks) {
    for (const ev of risk.evidence) {
      totalEvidence++;
      const result = verifyQuote(ev, getSourceText(ev));
      if (result.verified) verifiedCount++;
      else failures.push({ dimensionId: 'risk', quote: ev.quote.substring(0, 100), reason: result.reason });
    }
  }

  const failedCount = totalEvidence - verifiedCount;
  return {
    isValid: failedCount === 0 || totalEvidence === 0 || (failedCount / totalEvidence) < 0.2,
    totalEvidence,
    verifiedCount,
    failedCount,
    skippedCount,
    failures,
  };
}

export function validateEvidence(
  analysis: InflectionAnalysis,
  financialDataText: string,
): ValidationResult {
  const failures: ValidationResult['failures'] = [];
  let totalEvidence = 0;
  let verifiedCount = 0;
  let skippedCount = 0;

  const sourceText = financialDataText.toLowerCase();

  // Validate dimension evidence
  for (const dim of analysis.dimensions) {
    if (dim.signal === 'skipped') {
      skippedCount++;
      continue;
    }

    for (const ev of dim.evidence) {
      totalEvidence++;
      const result = verifyQuote(ev, sourceText);
      if (result.verified) {
        verifiedCount++;
      } else {
        failures.push({
          dimensionId: dim.id,
          quote: ev.quote.substring(0, 100),
          reason: result.reason,
        });
      }
    }
  }

  // Validate catalyst evidence
  for (const cat of analysis.catalysts) {
    for (const ev of cat.evidence) {
      totalEvidence++;
      const result = verifyQuote(ev, sourceText);
      if (result.verified) {
        verifiedCount++;
      } else {
        failures.push({
          dimensionId: 'catalyst',
          quote: ev.quote.substring(0, 100),
          reason: result.reason,
        });
      }
    }
  }

  // Validate risk evidence
  for (const risk of analysis.risks) {
    for (const ev of risk.evidence) {
      totalEvidence++;
      const result = verifyQuote(ev, sourceText);
      if (result.verified) {
        verifiedCount++;
      } else {
        failures.push({
          dimensionId: 'risk',
          quote: ev.quote.substring(0, 100),
          reason: result.reason,
        });
      }
    }
  }

  const failedCount = totalEvidence - verifiedCount;

  return {
    isValid: failedCount === 0 || (failedCount / totalEvidence) < 0.2,
    totalEvidence,
    verifiedCount,
    failedCount,
    skippedCount,
    failures,
  };
}

/** Extract meaningful tokens from text that may contain CJK characters.
 *  For CJK-heavy text, split(/\s+/) produces one giant token.
 *  Instead, extract: dollar values ($39.33B), percentages (39.5%), English words ≥4 chars, plain numbers. */
function extractTokens(text: string): string[] {
  const pattern = /\$[\d,.]+[bmkt]?|[\d,.]+%|[a-z]{4,}|[\d,.]+/gi;
  const matches = text.match(pattern);
  return matches ? matches.map(m => m.toLowerCase()) : [];
}

const SUFFIX_MULTIPLIER: Record<string, number> = {
  t: 1e12,
  b: 1e9,
  m: 1e6,
  k: 1e3,
};

/** Parse a human-readable number string into a numeric value.
 *  Handles: $39.33B → 39330000000, 39.5% → 39.5, $0.89 → 0.89, 764 → 764 */
function parseNumber(token: string): number | null {
  // Remove leading $ and commas
  let s = token.replace(/^\$/, '').replace(/,/g, '');
  // Strip trailing %
  if (s.endsWith('%')) {
    const n = parseFloat(s.slice(0, -1));
    return isNaN(n) ? null : n;
  }
  // Check for suffix multiplier (B, M, K, T)
  const lastChar = s.slice(-1).toLowerCase();
  if (SUFFIX_MULTIPLIER[lastChar]) {
    const n = parseFloat(s.slice(0, -1));
    return isNaN(n) ? null : n * SUFFIX_MULTIPLIER[lastChar];
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Extract all numbers from text, normalizing suffixes. */
export function extractNumbers(text: string): number[] {
  // Match dollar values with suffix, percentages, plain numbers with suffix, plain numbers
  const pattern = /\$[\d,.]+[bmkt]|[\d,.]+%|\$[\d,.]+|[\d,.]+[bmkt]|[\d,.]+/gi;
  const matches = text.match(pattern);
  if (!matches) return [];
  const nums: number[] = [];
  for (const m of matches) {
    const n = parseNumber(m);
    if (n !== null && n !== 0) nums.push(n);
  }
  return nums;
}

/** Check if two numbers match within a tolerance (default 2%). */
function numbersMatch(a: number, b: number, tolerance = 0.02): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  const max = Math.max(Math.abs(a), Math.abs(b));
  return max > 0 && diff / max <= tolerance;
}

function verifyQuote(
  evidence: Evidence,
  sourceText: string,
): { verified: boolean; reason: string } {
  const quote = evidence.quote.toLowerCase().trim();

  // Skip very short quotes (likely numbers or simple phrases)
  if (quote.length < 10) {
    return { verified: true, reason: 'short quote - skipped' };
  }

  // Direct substring match
  if (sourceText.includes(quote)) {
    return { verified: true, reason: 'exact match' };
  }

  // Fuzzy match: extract meaningful tokens (handles CJK mixed text)
  const quoteTokens = extractTokens(quote);
  // Also try legacy space-split for pure English text
  const quoteWordsLegacy = quote.split(/\s+/).filter(w => w.length > 3);
  const quoteWords = quoteTokens.length > 0 ? quoteTokens : quoteWordsLegacy;

  if (quoteWords.length === 0) {
    return { verified: true, reason: 'no significant words' };
  }

  const matchedWords = quoteWords.filter(w => sourceText.includes(w));
  const matchRatio = matchedWords.length / quoteWords.length;

  if (matchRatio >= 0.7) {
    return { verified: true, reason: `fuzzy match: ${(matchRatio * 100).toFixed(0)}% words found` };
  }

  // Check for partial phrase match (sliding window)
  const phraseWords = quote.split(/\s+/);
  if (phraseWords.length >= 5) {
    // Check 5-word windows
    for (let i = 0; i <= phraseWords.length - 5; i++) {
      const window = phraseWords.slice(i, i + 5).join(' ');
      if (sourceText.includes(window)) {
        return { verified: true, reason: 'partial phrase match' };
      }
    }
  }

  // Number extraction fallback: if the quote contains numbers,
  // check if ≥50% of them can be found in the source (within 2% tolerance)
  const quoteNums = extractNumbers(evidence.quote);
  if (quoteNums.length > 0) {
    const sourceNums = extractNumbers(sourceText);
    let matched = 0;
    for (const qn of quoteNums) {
      if (sourceNums.some(sn => numbersMatch(qn, sn))) {
        matched++;
      }
    }
    const numRatio = matched / quoteNums.length;
    if (numRatio >= 0.5) {
      return { verified: true, reason: `number match: ${matched}/${quoteNums.length} numbers verified` };
    }
  }

  return {
    verified: false,
    reason: `Quote not found in source (${(matchRatio * 100).toFixed(0)}% word match)`,
  };
}
