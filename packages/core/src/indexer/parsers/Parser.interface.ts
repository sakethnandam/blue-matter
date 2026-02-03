/**
 * Parser contract - language-specific code parsers
 */

import type { Symbol } from '../../models/Symbol.js';

export interface ParseResult {
  symbols: Symbol[];
  language: string;
  imports: string[];
  exports: string[];
}

export interface Parser {
  readonly language: string;
  readonly extensions: string[];
  parse(content: string, filePath: string): ParseResult;
  canParse(filePath: string): boolean;
}
