// src/parser/chunket.ts

import type { CodeUnit, CodeChunk } from '../types/index.js';

// ============================================================
// SEMANTIC CHUNKING - Each function/class gets its own chunk
// ============================================================

export function createSemanticChunks(
  units: CodeUnit[],
  maxTokens: number = 500
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  
  // 1. Group all imports together
  const imports = units.filter(u => u.type === 'import');
  if (imports.length > 0) {
    const content = imports.map(i => i.content).join('\n');
    chunks.push({
      id: 'chunk_imports',
      type: 'imports',
      name: 'all_imports',
      content,
      startLine: imports[0]?.startLine || 0,
      endLine: imports[imports.length - 1]?.endLine || 0,
      dependencies: imports.flatMap(i => i.dependencies),
      exports: [],
    });
  }

  // 2. Each non-import unit gets its own chunk
  const nonImports = units.filter(u => u.type !== 'import');
  for (const unit of nonImports) {
    // Estimate tokens for this unit
    const tokenCount = Math.ceil(unit.content.length / 4);
    
    // If a single unit is too large, split it by lines
    if (tokenCount > maxTokens && unit.content.split('\n').length > 20) {
      const splitChunks = splitLargeUnit(unit, maxTokens);
      chunks.push(...splitChunks);
    } else {
      chunks.push({
        id: `chunk_${chunks.length + 1}`,
        type: unit.type,
        name: unit.name || 'anonymous',
        content: unit.content,
        startLine: unit.startLine,
        endLine: unit.endLine,
        dependencies: unit.dependencies || [],
        exports: unit.exports || [],
      });
    }
  }

  // 3. Add overlap context to each chunk
  return chunks.map((chunk, index) => {
    if (index === 0) return chunk;
    const prevChunk = chunks[index - 1];
    if (!prevChunk) return chunk;
    
    const prevLines = prevChunk.content.split('\n');
    const overlapLines = prevLines.slice(-3).join('\n');
    
    return {
      ...chunk,
      context: `/* Previous context */\n${overlapLines}`,
    };
  });
}

// ============================================================
// SPLIT LARGE UNITS (e.g., very large functions)
// ============================================================

function splitLargeUnit(unit: CodeUnit, maxTokens: number): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = unit.content.split('\n');
  let currentLines: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;
  let startLine = unit.startLine;

  for (const line of lines) {
    const lineTokens = Math.ceil(line.length / 4);
    if (currentTokens + lineTokens > maxTokens && currentLines.length > 0) {
      chunks.push({
        id: `chunk_${unit.type}_${chunkIndex + 1}`,
        type: unit.type,
        name: `${unit.name}_part${chunkIndex + 1}`,
        content: currentLines.join('\n'),
        startLine,
        endLine: startLine + currentLines.length - 1,
        dependencies: unit.dependencies || [],
        exports: unit.exports || [],
      });
      currentLines = [];
      currentTokens = 0;
      startLine += currentLines.length;
      chunkIndex++;
    }
    currentLines.push(line);
    currentTokens += lineTokens;
  }

  // Flush remaining lines
  if (currentLines.length > 0) {
    chunks.push({
      id: `chunk_${unit.type}_${chunkIndex + 1}`,
      type: unit.type,
      name: `${unit.name}_part${chunkIndex + 1}`,
      content: currentLines.join('\n'),
      startLine,
      endLine: startLine + currentLines.length - 1,
      dependencies: unit.dependencies || [],
      exports: unit.exports || [],
    });
  }

  return chunks;
}

// ============================================================
// TOKEN ESTIMATION (for reference)
// ============================================================

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}