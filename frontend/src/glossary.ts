import type { GlossaryEntry } from "./courseTypes";

export type GlossaryMatch = {
  definition: string;
  externalUrl?: string;
  label: string;
  term: string;
};

type GlossaryLookup = GlossaryMatch & { lowerTerm: string };

export function findGlossaryMatch(
  text: string,
  index: number,
  glossary: GlossaryEntry[]
): GlossaryMatch | undefined {
  const lowerText = text.toLowerCase();
  return buildLookups(glossary).find((lookup) => matchesAt(lowerText, text, index, lookup));
}

function buildLookups(glossary: GlossaryEntry[]): GlossaryLookup[] {
  return glossary
    .flatMap((entry) =>
      entry.terms.map((term) => ({
        definition: entry.definition,
        externalUrl: entry.externalUrl,
        label: entry.label,
        lowerTerm: term.toLowerCase(),
        term
      }))
    )
    .sort((left, right) => right.term.length - left.term.length);
}

function matchesAt(lowerText: string, originalText: string, index: number, lookup: GlossaryLookup): boolean {
  if (!lowerText.startsWith(lookup.lowerTerm, index)) return false;
  const before = index > 0 ? originalText[index - 1] : "";
  const after = originalText[index + lookup.term.length] ?? "";
  return !isWordCharacter(before) && !isWordCharacter(after);
}

function isWordCharacter(character: string): boolean {
  return /^[A-Za-z0-9_]$/.test(character);
}
