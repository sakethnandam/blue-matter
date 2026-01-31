/**
 * v1 taxonomy: data structures, loops, basic libraries.
 * Display names and optional curated YouTube video IDs (hybrid).
 */
export interface ConceptDef {
  id: string;
  label: string;
  category: 'data_structure' | 'loop' | 'library';
  /** Optional curated video IDs for "well-explained" badge */
  curatedVideoIds?: string[];
}

export const CONCEPTS: ConceptDef[] = [
  // Data structures
  { id: 'list', label: 'list', category: 'data_structure' },
  { id: 'dict', label: 'dict', category: 'data_structure' },
  { id: 'set', label: 'set', category: 'data_structure' },
  { id: 'tuple', label: 'tuple', category: 'data_structure' },
  { id: 'deque', label: 'deque', category: 'data_structure' },
  { id: 'defaultdict', label: 'defaultdict', category: 'data_structure' },
  { id: 'Counter', label: 'Counter', category: 'data_structure' },
  { id: 'OrderedDict', label: 'OrderedDict', category: 'data_structure' },
  // Loops
  { id: 'for', label: 'for loop', category: 'loop' },
  { id: 'while', label: 'while loop', category: 'loop' },
  { id: 'list_comprehension', label: 'list comprehension', category: 'loop' },
  { id: 'dict_comprehension', label: 'dict comprehension', category: 'loop' },
  { id: 'set_comprehension', label: 'set comprehension', category: 'loop' },
  { id: 'generator', label: 'generator', category: 'loop' },
  // Libraries
  { id: 'pathlib', label: 'pathlib (Path)', category: 'library' },
  { id: 'requests', label: 'requests', category: 'library' },
  { id: 'collections', label: 'collections', category: 'library' },
  { id: 'itertools', label: 'itertools', category: 'library' },
  { id: 'os', label: 'os', category: 'library' },
  { id: 'json', label: 'json', category: 'library' },
  { id: 're', label: 're (regex)', category: 'library' },
  { id: 'dataclasses', label: 'dataclasses', category: 'library' },
  { id: 'typing', label: 'typing', category: 'library' },
];

const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));

export function getConcept(id: string): ConceptDef | undefined {
  return conceptById.get(id);
}

export function getConceptLabel(id: string): string {
  return conceptById.get(id)?.label ?? id;
}
