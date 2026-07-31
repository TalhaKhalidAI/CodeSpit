// src/parser/extractor.ts

import type { ParseResult, ExtractOptions, Summary } from '../types/index.js';
import { findFiles, readFileContent, isTypeScriptFile, isJavaScriptFile, isPythonFile } from '../utils/fileUtils.js';
import { parseFile } from './astParser.js';

const defaultOptions: ExtractOptions = {
  maxLines: 500,
  maxChunkTokens: 500,
  overlapLines: 3,
  ignoreDirs: ['node_modules', '.git', 'dist', 'build'],
  includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py'],
  useCompactOutput: false,
};

export async function extractCodebase(
  rootDir: string,
  options: Partial<ExtractOptions> = {}
): Promise<{ results: ParseResult[]; summary: Summary }> {
  const opts = { ...defaultOptions, ...options };
  
  const files = await findFiles(rootDir, opts.includeExtensions, opts.ignoreDirs);
  
  const results: ParseResult[] = [];
  let totalLines = 0;

  for (const file of files) {
    const code = readFileContent(file);
    const lines = code.split('\n').length;
    totalLines += lines;

    let result: ParseResult;
    
    if (isTypeScriptFile(file) || isJavaScriptFile(file) || isPythonFile(file)) {
      try {
        result = parseFile(file, code);
      } catch (e) {
        result = {
          file,
          language: 'Unknown',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          interfaces: [],
          types: [],
          chunks: [],
          totalChunks: 0,
          totalItems: 0,
        };
      }
    } else {
      result = {
        file,
        language: 'Unknown',
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        interfaces: [],
        types: [],
        chunks: [],
        totalChunks: 0,
        totalItems: 0,
      };
    }

    results.push(result);
  }

  const summary: Summary = {
    totalFiles: results.length,
    totalLines,
    totalChunks: results.reduce((sum, r) => sum + r.totalChunks, 0),
    totalFunctions: results.reduce((sum, r) => sum + r.functions.length, 0),
    totalClasses: results.reduce((sum, r) => sum + r.classes.length, 0),
    totalImports: results.reduce((sum, r) => sum + r.imports.length, 0),
    totalExports: results.reduce((sum, r) => sum + r.exports.length, 0),
  };

  return { results, summary };
}