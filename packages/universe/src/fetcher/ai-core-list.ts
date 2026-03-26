import { readFileSync } from 'node:fs';

/**
 * Load AI Core tickers from a plain-text file.
 * One ticker per line. Lines starting with '#' are comments.
 * Leading/trailing whitespace is trimmed. Empty lines are ignored.
 *
 * @example
 * # My AI Core Pool
 * NVDA
 * TSLA
 * META
 */
export function loadAiCoreListFromFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim().toUpperCase())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}
