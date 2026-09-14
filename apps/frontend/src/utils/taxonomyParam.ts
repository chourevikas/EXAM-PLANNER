/**
 * Utility to parse and format taxonomy filter URL parameters (subjects, topics, subtopics).
 * Because syllabus topics and subtopics may contain commas in their names (e.g. 'Bengal Partition,Swadeshi Boycott Movement',
 * 'Waves, Ocean Currents, Tides'), this utility supports both ';;' / '||' delimiters and greedy token matching against available items.
 */

export function parseTaxonomyParam(
  rawParam: string | null | undefined,
  availableList: string[] = [],
): string[] {
  if (!rawParam || rawParam.startsWith('All ')) return [];
  const trimmed = rawParam.trim();
  if (!trimmed) return [];

  // Delimiter ';;' explicitly handles multi-item selections containing commas
  if (trimmed.includes(';;')) {
    const tokens = trimmed.split(';;').map((t) => t.trim()).filter(Boolean);
    return availableList.length > 0 ? tokens.filter((t) => availableList.includes(t)) : tokens;
  }
  if (trimmed.includes('||')) {
    const tokens = trimmed.split('||').map((t) => t.trim()).filter(Boolean);
    return availableList.length > 0 ? tokens.filter((t) => availableList.includes(t)) : tokens;
  }

  // Exact single match against availableList even if it contains commas
  if (availableList.includes(trimmed)) {
    return [trimmed];
  }

  // If availableList is empty yet (before API loads), split by comma fallback
  if (!availableList || availableList.length === 0) {
    return trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  }

  // Greedy match against availableList:
  // Sort candidates by length descending so that comma-containing topics match before substring fragments
  const sortedCandidates = [...availableList].sort((a, b) => b.length - a.length);
  const matched: string[] = [];
  let remainder = trimmed;

  for (const candidate of sortedCandidates) {
    if (!candidate) continue;
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|,)\\s*${escaped}\\s*(,|$)`, 'i');
    if (regex.test(remainder)) {
      matched.push(candidate);
      remainder = remainder
        .replace(regex, '$1$2')
        .replace(/^,+|,+$/g, '')
        .replace(/,,+/g, ',');
    }
  }

  if (matched.length > 0) {
    // Return items in availableList ordering
    return availableList.filter((item) => matched.includes(item));
  }

  // Fallback: simple comma split filtered against availableList
  const simpleSplit = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  const valid = simpleSplit.filter((t) => availableList.includes(t));
  return valid.length > 0 ? valid : simpleSplit;
}

export function formatTaxonomyParam(items: string[]): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  const hasComma = items.some((item) => item.includes(','));
  return hasComma ? items.join(';;') : items.join(',');
}

export function parseYearParam(
  rawYear: string | null | undefined,
  availableYears: string[] = [],
): string[] {
  if (!rawYear || rawYear.startsWith('All Years') || rawYear.startsWith('All ')) return [];
  const trimmed = rawYear.trim();
  if (!trimmed) return [];

  const tokens = trimmed.includes(';;')
    ? trimmed.split(';;')
    : trimmed.includes('||')
    ? trimmed.split('||')
    : trimmed.split(',');
  const cleanedTokens = tokens.map((t) => t.trim()).filter(Boolean);

  if (availableYears.length === 0) return cleanedTokens;

  const matched: string[] = [];
  cleanedTokens.forEach((tok) => {
    const exact = availableYears.find(
      (y) => y.toLowerCase() === tok.toLowerCase() && !y.startsWith('All Years'),
    );
    if (exact && !matched.includes(exact)) {
      matched.push(exact);
      return;
    }
    const m = tok.match(/\b(19\d\d|20\d\d)\b/);
    if (m) {
      const yrNum = m[1];
      const found = availableYears.find(
        (y) => y.includes(yrNum) && !y.startsWith('All Years'),
      );
      if (found && !matched.includes(found)) {
        matched.push(found);
      }
    }
  });
  return matched;
}

