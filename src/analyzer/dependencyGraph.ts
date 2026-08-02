// src/analyzer/dependencyGraph.ts
import { ParseResult } from '../types/index.js';
import path from 'path';

export interface DependencyNode {
  file: string;
  imports: string[]; // All imported file paths
  importedBy: string[]; // Files that import this
  exports: string[];
  functions: string[];
  classes: string[];
  depth: number; // Distance from entry point
}

export class DependencyGraph {
  public nodes = new Map<string, DependencyNode>(); // Made public
  private fileMap = new Map<string, ParseResult>();
  
  constructor(results: ParseResult[]) {
    // Build file map
    for (const result of results) {
      this.fileMap.set(result.file, result);
      this.nodes.set(result.file, {
        file: result.file,
        imports: [],
        importedBy: [],
        exports: result.exports.map(e => e.name),
        functions: result.functions.map(f => f.name),
        classes: result.classes.map(c => c.name),
        depth: Infinity
      });
    }
    
    // Build edges from imports
    for (const result of results) {
      const node = this.nodes.get(result.file);
      if (!node) continue;
      
      // Extract import paths from CodeSpit's imports
      for (const imp of result.imports) {
        const resolvedPath = this.resolveImportPath(imp.name, result.file);
        if (resolvedPath && this.nodes.has(resolvedPath)) {
          node.imports.push(resolvedPath);
          const importedNode = this.nodes.get(resolvedPath);
          if (importedNode) {
            importedNode.importedBy.push(result.file);
          }
        }
      }
    }
  }
  
  private resolveImportPath(importPath: string, fromFile: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);
      
      // Try .ts, .tsx, .js, .jsx, /index.ts
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
      
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (this.fileMap.has(withExt)) return withExt;
      }
      
      // Try /index
      for (const ext of extensions) {
        const indexFile = path.join(resolved, `index${ext}`);
        if (this.fileMap.has(indexFile)) return indexFile;
      }
    }
    
    return null;
  }
  
  getReachableFiles(entryPoints: string[], maxDepth: number = 3): string[] {
    const visited = new Set<string>();
    const queue: { file: string; depth: number }[] = [];
    
    // Add all entry points
    for (const entry of entryPoints) {
      if (this.nodes.has(entry)) {
        queue.push({ file: entry, depth: 0 });
        visited.add(entry);
      }
    }
    
    // BFS traversal
    const result: string[] = [];
    while (queue.length > 0) {
      const { file, depth } = queue.shift()!;
      result.push(file);
      
      // Update depth
      const node = this.nodes.get(file);
      if (node) {
        node.depth = Math.min(node.depth, depth);
      }
      
      // Stop at max depth
      if (depth >= maxDepth) continue;
      
      // Visit imports
      const nodeData = this.nodes.get(file);
      if (!nodeData) continue;
      
      for (const imported of nodeData.imports) {
        if (!visited.has(imported)) {
          visited.add(imported);
          queue.push({ file: imported, depth: depth + 1 });
        }
      }
    }
    
    return result;
  }
  
  getDependencyChain(entryFile: string, targetFile: string): string[] | null {
    const queue: { file: string; path: string[] }[] = [
      { file: entryFile, path: [entryFile] }
    ];
    const visited = new Set<string>([entryFile]);
    
    while (queue.length > 0) {
      const { file, path } = queue.shift()!;
      
      if (file === targetFile) {
        return path;
      }
      
      const node = this.nodes.get(file);
      if (!node) continue;
      
      for (const imported of node.imports) {
        if (!visited.has(imported)) {
          visited.add(imported);
          queue.push({ file: imported, path: [...path, imported] });
        }
      }
    }
    
    return null;
  }
  
  findCriticalFiles(topN: number = 10): string[] {
    const sorted = Array.from(this.nodes.entries())
      .map(([file, node]) => ({
        file,
        score: node.imports.length * 2 + node.importedBy.length * 3,
        node
      }))
      .sort((a, b) => b.score - a.score);
    
    return sorted.slice(0, topN).map(item => item.file);
  }
}