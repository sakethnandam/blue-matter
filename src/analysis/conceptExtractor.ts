import { parsePython, ParseResult } from './pythonParser';
import { getConceptLabel } from '../taxonomy/concepts';

export type { ParseResult };

export interface ExtractedConcept {
  id: string;
  label: string;
}

/**
 * Extract unique concepts from Python source (full file or selection).
 */
export function extractConcepts(source: string): ParseResult {
  const result = parsePython(source);
  return result;
}

/**
 * Get display labels for concept IDs.
 */
export function getLabels(conceptIds: string[]): ExtractedConcept[] {
  return conceptIds.map((id) => ({
    id,
    label: getConceptLabel(id),
  }));
}
