export function parseSpecKeywordsInput(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of raw.split(/[,\n]/)) {
    const normalized = token.trim();
    if (!normalized) continue;

    // Preserve user casing while preventing duplicate filter terms.
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    result.push(normalized);
  }

  return result;
}
