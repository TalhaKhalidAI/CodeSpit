// src/types/index.ts

export interface CodeUnit {
  type: 'import' | 'export' | 'function' | 'class' | 'interface' | 'type' | 'variable';
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
  exports: string[];
}

export interface CodeChunk {
  id: string;
  type: string;
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
  exports: string[];
  context?: string;
}

export interface ParseResult {
  file: string;
  language: string;
  imports: CodeUnit[];
  exports: CodeUnit[];
  functions: CodeUnit[];
  classes: CodeUnit[];
  interfaces: CodeUnit[];
  types: CodeUnit[];
  chunks: CodeChunk[];
  totalChunks: number;
  totalItems: number;
}

export interface ExtractOptions {
  maxLines: number;
  maxChunkTokens: number;
  overlapLines: number;
  ignoreDirs: string[];
  includeExtensions: string[];
  useCompactOutput: boolean; // ✅ NEW: Switch between full/compact
}

export interface Summary {
  totalFiles: number;
  totalLines: number;
  totalChunks: number;
  totalFunctions: number;
  totalClasses: number;
  totalImports: number;
  totalExports: number;
}