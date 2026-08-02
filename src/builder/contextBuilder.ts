// src/builder/contextBuilder.ts
import { ParseResult } from '../types/index.js';
import { DependencyGraph } from '../analyzer/dependencyGraph.js'; // Removed DependencyNode
import { estimateTokens } from '../utils/tokenCalculator.js';
import path from 'path';
// Removed fs import - not used

export interface ContextBuildOptions {
  entryFiles: string[];
  maxDepth: number;
  maxTokens: number;
  includeExports: boolean;
  includeFunctions: boolean;
  includeClasses: boolean;
  mode: 'compact' | 'full';
  dependencyStrategy: 'all' | 'direct' | 'minimal';
}

export class SmartContextBuilder {
  private graph: DependencyGraph;
  private results: Map<string, ParseResult>;
  
  constructor(results: ParseResult[]) {
    this.graph = new DependencyGraph(results);
    this.results = new Map(results.map(r => [r.file, r]));
  }
  
  buildContext(options: ContextBuildOptions): {
    context: string;
    includedFiles: string[];
    tokens: number;
    tokenBreakdown: Record<string, number>;
  } {
    // 1. Find all reachable files
    let allFiles = new Set<string>();
    
    for (const entry of options.entryFiles) {
      const reachable = this.graph.getReachableFiles([entry], options.maxDepth);
      for (const file of reachable) {
        allFiles.add(file);
      }
    }
    
    // 2. Score and prioritize
    const scoredFiles = this.scoreFiles(Array.from(allFiles), options.entryFiles);
    
    // 3. Select files based on token budget
    const selectedFiles = this.selectFilesByBudget(
      scoredFiles,
      options.maxTokens,
      options.dependencyStrategy
    );
    
    // 4. Build the actual context
    const context = this.buildOutput(selectedFiles, options);
    
    // 5. Calculate token usage
    const tokenBreakdown: Record<string, number> = {};
    for (const file of selectedFiles) {
      const result = this.results.get(file);
      if (result) {
        tokenBreakdown[file] = estimateTokens(JSON.stringify(result));
      }
    }
    
    return {
      context,
      includedFiles: selectedFiles,
      tokens: Object.values(tokenBreakdown).reduce((a, b) => a + b, 0),
      tokenBreakdown
    };
  }
  
  private scoreFiles(files: string[], entryPoints: string[]): { file: string; score: number }[] {
    return files.map(file => {
      const node = this.graph.nodes.get(file);
      if (!node) return { file, score: 0 };
      
      let score = 0;
      
      // Entry points get highest score
      if (entryPoints.includes(file)) {
        score += 100;
      }
      
      // Files with many imports (hub files)
      score += node.imports.length * 2;
      
      // Files imported by many others (critical dependencies)
      score += node.importedBy.length * 3;
      
      // Files with exports
      score += node.exports.length * 5;
      
      // Closer to entry = higher priority (depth matters)
      if (node.depth < 3) {
        score += (3 - node.depth) * 10;
      }
      
      // Files in src/ are more important than tests
      if (file.includes('/src/')) {
        score += 10;
      }
      
      return { file, score };
    });
  }
  
  private selectFilesByBudget(
    scoredFiles: { file: string; score: number }[],
    maxTokens: number,
    strategy: 'all' | 'direct' | 'minimal'
  ): string[] {
    // Sort by score (highest first)
    scoredFiles.sort((a, b) => b.score - a.score);
    
    const selected: string[] = [];
    let tokens = 0;
    const budget = maxTokens * 0.7; // Leave room for formatting
    
    for (const item of scoredFiles) {
      const result = this.results.get(item.file);
      if (!result) continue;
      
      const fileTokens = estimateTokens(JSON.stringify(result));
      
      if (tokens + fileTokens <= budget) {
        selected.push(item.file);
        tokens += fileTokens;
      } else {
        if (strategy === 'all') {
          selected.push(item.file);
        }
      }
    }
    
    return selected;
  }
  
  private buildOutput(files: string[], options: ContextBuildOptions): string {
    let output = '';
    
    output += '============================================================\n';
    output += `🤖 CodeSpit - DEPENDENCY-AWARE CONTEXT\n`;
    output += `   Mode: ${options.mode}\n`;
    output += `   Strategy: ${options.dependencyStrategy}\n`;
    output += `   Depth: ${options.maxDepth}\n`;
    output += '============================================================\n\n';
    
    // Show dependency graph first
    output += '📊 Dependency Graph Summary:\n';
    output += '─────────────────────────────────────────────────\n';
    
    for (const file of files) {
      const node = this.graph.nodes.get(file);
      if (!node) continue;
      
      const relPath = path.relative(process.cwd(), file);
      
      output += `📄 ${relPath}\n`;
      output += `   Depth: ${node.depth === Infinity ? '?' : node.depth}\n`;
      output += `   Exports: ${node.exports.join(', ') || 'none'}\n`;
      output += `   Imports: ${node.imports.length} files\n`;
      output += `   Used by: ${node.importedBy.length} files\n\n`;
    }
    
    // Then include actual code
    for (const file of files) {
      const result = this.results.get(file);
      if (!result) continue;
      
      const node = this.graph.nodes.get(file);
      const relPath = path.relative(process.cwd(), file);
      
      output += `\n📄 ${path.basename(file)}\n`;
      output += `    📄 [${relPath}]\n`;
      output += `    └── CONTENT:\n`;
      
      // AST Summary (compact)
      output += `        🔬 AST ANALYSIS:\n`;
      output += `        📊 AST Summary:\n`;
      output += `          • Functions: ${result.functions.length}\n`;
      output += `          • Classes: ${result.classes.length}\n`;
      output += `          • Imports: ${result.imports.length}\n`;
      
      // Determine if we should show full code
      const isCritical = node && node.depth === 0;
      
      // Only include full code in full mode or for critical files
      if (options.mode === 'full' || isCritical) {
        // Include chunks
        for (const chunk of result.chunks || []) {
          output += `\n        ── ${chunk.type}: ${chunk.name} ──\n`;
          const lines = chunk.content.split('\n');
          const maxLines = options.mode === 'full' ? 30 : 10;
          
          for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
            output += `        ${lines[i]}\n`;
          }
          if (lines.length > maxLines) {
            output += `        ... (${lines.length - maxLines} more lines)\n`;
          }
        }
      } else {
        // Only include signatures for dependencies
        if (result.functions.length > 0) {
          output += `        📋 Functions: ${result.functions.map(f => f.name).join(', ')}\n`;
        }
        if (result.classes.length > 0) {
          output += `        📋 Classes: ${result.classes.map(c => c.name).join(', ')}\n`;
        }
        if (options.includeExports && result.exports.length > 0) {
          output += `        📋 Exports: ${result.exports.map(e => e.name).join(', ')}\n`;
        }
      }
    }
    
    return output;
  }
}