import { KNOWN_METHODS } from './methods.js';

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

export function findSimilarMethods(
  input: string,
  methods: string[] = KNOWN_METHODS,
  maxResults: number = 3,
): string[] {
  // Exact match — no suggestions needed
  if (methods.includes(input)) return [];

  // Case-insensitive exact match
  const lowerInput = input.toLowerCase();
  const caseMatch = methods.find(m => m.toLowerCase() === lowerInput);
  if (caseMatch) return [caseMatch];

  // Levenshtein distance for all methods
  const threshold = Math.min(5, Math.max(2, Math.floor(input.length * 0.3)));
  const scored = methods
    .map(m => ({ method: m, distance: levenshteinDistance(lowerInput, m.toLowerCase()) }))
    .filter(s => s.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);

  return scored.slice(0, maxResults).map(s => s.method);
}
