#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { extractCodebase } from './parser/extractor.js';
import { parseFile } from './parser/astParser.js';
import { logger, formatNumber } from './utils/logger.js';
import { getRelativePath, writeOutputFile } from './utils/fileUtils.js';
import type { ExtractOptions, ParseResult } from './types/index.js';
import { SmartContextBuilder } from './builder/contextBuilder.js';
import { estimateTokens } from './utils/tokenCalculator.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// ============================================================
// FILE TREE BUILDER
// ============================================================

function buildFileTree(results: ParseResult[], rootDir: string): string {
  const tree: Record<string, any> = {};

  for (const result of results) {
    const relPath = getRelativePath(result.file, rootDir);
    const parts = relPath.split('/');
    let current: Record<string, any> = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined || part === '') continue;
      if (i === parts.length - 1) {
        current[part] = 'file';
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        const next = current[part];
        if (typeof next === 'object' && next !== null) {
          current = next as Record<string, any>;
        } else {
          const newObj: Record<string, any> = {};
          current[part] = newObj;
          current = newObj;
        }
      }
    }
  }

  function renderTree(obj: Record<string, any>, prefix: string = ''): string {
    let result = '';
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === undefined) continue;
      
      const value = obj[key];
      const isFile = value === 'file';
      const isLastItem = i === keys.length - 1;

      if (isFile) {
        result += `${prefix}${isLastItem ? '└── ' : '├── '}📄 ${key}\n`;
      } else if (typeof value === 'object' && value !== null) {
        result += `${prefix}${isLastItem ? '└── ' : '├── '}📁 ${key}/\n`;
        const newPrefix = prefix + (isLastItem ? '    ' : '│   ');
        result += renderTree(value as Record<string, any>, newPrefix);
      }
    }
    return result;
  }

  return renderTree(tree);
}

// ============================================================
// PARSE SINGLE FILE
// ============================================================

function parseSingleFile(filePath: string, options: Partial<ExtractOptions>): ParseResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File '${filePath}' does not exist!`);
  }
  
  if (!fs.statSync(filePath).isFile()) {
    throw new Error(`'${filePath}' is not a file!`);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  
  const supportedExtensions = options.includeExtensions || ['.ts', '.tsx', '.js', '.jsx', '.py'];
  if (!supportedExtensions.includes(ext)) {
    logger.warn(`Extension '${ext}' may not be fully supported. Trying to parse anyway...`);
  }

  try {
    const result = parseFile(filePath, code);
    return result;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error}`);
  }
}

// ============================================================
// FORMAT SINGLE FILE OUTPUT
// ============================================================

function buildASTSummary(result: ParseResult): string {
  let output = '';
  output += `        🔬 AST ANALYSIS:\n`;
  output += `        📊 AST Summary:\n`;
  output += `          • Language: ${result.language}\n`;
  output += `          • Functions: ${result.functions.length}\n`;
  output += `          • Classes: ${result.classes.length}\n`;
  output += `          • Imports: ${result.imports.length}\n`;

  if (result.functions.length > 0) {
    output += `        📋 Functions Found:\n`;
    for (const fn of result.functions) {
      output += `          • ${fn.name} (lines ${fn.startLine}-${fn.endLine})\n`;
    }
  }

  if (result.classes.length > 0) {
    output += `        📋 Classes Found:\n`;
    for (const cls of result.classes) {
      output += `          • ${cls.name} (lines ${cls.startLine}-${cls.endLine})\n`;
    }
  }

  if (result.interfaces.length > 0) {
    output += `        📋 Interfaces Found:\n`;
    for (const intf of result.interfaces) {
      output += `          • ${intf.name} (lines ${intf.startLine}-${intf.endLine})\n`;
    }
  }

  if (result.types.length > 0) {
    output += `        📋 Types Found:\n`;
    for (const type of result.types) {
      output += `          • ${type.name} (lines ${type.startLine}-${type.endLine})\n`;
    }
  }

  return output;
}

function buildChunksOutput(result: ParseResult, useCompactOutput: boolean): string {
  let output = '';
  
  if (result.chunks.length === 0) {
    return output;
  }

  output += `        🧩 Semantic Chunks:\n`;
  const maxChunks = useCompactOutput ? result.chunks.length : Math.min(result.chunks.length, 10);
  
  for (let i = 0; i < maxChunks; i++) {
    const chunk = result.chunks[i];
    if (!chunk) continue;
    
    output += `          ── Chunk ${i + 1}: ${chunk.type} (${chunk.name}) ──\n`;
    const chunkLines = chunk.content.split('\n');
    const maxLines = useCompactOutput ? 15 : 30;
    
    for (let j = 0; j < Math.min(chunkLines.length, maxLines); j++) {
      output += `          ${chunkLines[j]}\n`;
    }
    if (chunkLines.length > maxLines) {
      output += `          ... (truncated, ${chunkLines.length} total lines)\n`;
    }
  }
  
  if (result.chunks.length > 10 && !useCompactOutput) {
    output += `          ... and ${result.chunks.length - 10} more chunks\n`;
  }

  return output;
}

function buildSourceCodeOutput(code: string, options: Partial<ExtractOptions>): string {
  let output = `\n        📄 Source Code:\n`;
  const maxLines = options.maxLines || 500;
  const lines = code.split('\n');
  
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    output += `        ${String(i + 1).padStart(4, ' ')} │ ${lines[i]}\n`;
  }
  if (lines.length > maxLines) {
    output += `        ... (truncated at ${maxLines} lines)\n`;
  }
  
  return output;
}

function buildSingleFileSummary(result: ParseResult): string {
  let output = '';
  output += '\n============================================================\n';
  output += '📊 EXTRACTION SUMMARY\n';
  output += '============================================================\n';
  output += `Functions Found:  ${formatNumber(result.functions.length)}\n`;
  output += `Classes Found:    ${formatNumber(result.classes.length)}\n`;
  output += `Imports Found:    ${formatNumber(result.imports.length)}\n`;
  output += `Exports Found:    ${formatNumber(result.exports.length)}\n`;
  output += `Total Chunks:     ${formatNumber(result.totalChunks)}\n`;
  output += '============================================================\n';
  return output;
}

function formatSingleFileOutput(
  result: ParseResult,
  options: Partial<ExtractOptions>,
  code: string,
  useCompactOutput: boolean
): string {
  let output = '';
  const fileName = path.basename(result.file);
  const relPath = getRelativePath(result.file, process.cwd());

  output += '============================================================\n';
  output += `🤖 CodeSpit - AI-READY CODE CONTEXT WITH AST PARSING\n`;
  output += `   Mode: ${useCompactOutput ? 'COMPACT (AST only)' : 'FULL (with line numbers)'}\n`;
  output += '============================================================\n';
  output += `File:      ${fileName}\n`;
  output += `Path:      ${relPath}\n`;
  output += `Date:      ${new Date().toISOString()}\n`;
  output += '============================================================\n\n';

  output += `📄 ${fileName}\n`;
  output += `    📄 [${relPath}]\n`;
  output += `    └── CONTENT:\n`;

  output += buildASTSummary(result);
  output += buildChunksOutput(result, useCompactOutput);

  if (!useCompactOutput) {
    output += buildSourceCodeOutput(code, options);
  }

  output += buildSingleFileSummary(result);

  return output;
}

// ============================================================
// FORMAT DIRECTORY OUTPUT
// ============================================================

function formatDirectoryOutput(
  results: ParseResult[],
  summary: any,
  targetPath: string,
  options: Partial<ExtractOptions>,
  useCompactOutput: boolean
): string {
  let output = '';
  
  output += '============================================================\n';
  output += `🤖 CodeSpit - AI-READY CODE CONTEXT WITH AST PARSING\n`;
  output += `   Mode: ${useCompactOutput ? 'COMPACT (AST only)' : 'FULL (with line numbers)'}\n`;
  output += '============================================================\n';
  output += `Project:   ${path.basename(targetPath)}\n`;
  output += `Path:      ${targetPath}\n`;
  output += `Date:      ${new Date().toISOString()}\n`;
  output += `Max Lines: ${options.maxLines}\n`;
  output += '============================================================\n\n';

  output += '📁 Project Structure:\n';
  output += '─────────────────────────────────────────────────\n';
  const fileTree = buildFileTree(results, targetPath);
  output += fileTree;

  for (const result of results) {
    const relPath = getRelativePath(result.file, targetPath);
    const code = fs.readFileSync(result.file, 'utf-8');

    output += `\n📄 ${path.basename(result.file)}\n`;
    output += `    📄 [${relPath}]\n`;
    output += `    └── CONTENT:\n`;

    output += `        🔬 AST ANALYSIS:\n`;
    output += `        📊 AST Summary:\n`;
    output += `          • Language: ${result.language}\n`;
    output += `          • Functions: ${result.functions.length}\n`;
    output += `          • Classes: ${result.classes.length}\n`;
    output += `          • Imports: ${result.imports.length}\n`;

    if (result.functions.length > 0) {
      output += `        📋 Functions Found:\n`;
      for (const fn of result.functions.slice(0, 10)) {
        output += `          • ${fn.name}\n`;
      }
      if (result.functions.length > 10) {
        output += `          ... and ${result.functions.length - 10} more\n`;
      }
    }

    if (result.classes.length > 0) {
      output += `        📋 Classes Found:\n`;
      for (const cls of result.classes.slice(0, 10)) {
        output += `          • ${cls.name}\n`;
      }
      if (result.classes.length > 10) {
        output += `          ... and ${result.classes.length - 10} more\n`;
      }
    }

    if (result.chunks.length > 0) {
      output += `        🧩 Semantic Chunks:\n`;
      for (let i = 0; i < Math.min(result.chunks.length, 5); i++) {
        const chunk = result.chunks[i];
        if (!chunk) continue;
        output += `          ── Chunk ${i + 1}: ${chunk.type} (${chunk.name}) ──\n`;
        const chunkLines = chunk.content.split('\n');
        for (let j = 0; j < Math.min(chunkLines.length, 10); j++) {
          output += `          ${chunkLines[j]}\n`;
        }
        if (chunkLines.length > 10) {
          output += `          ... (truncated, ${chunkLines.length} total lines)\n`;
        }
      }
      if (result.chunks.length > 5) {
        output += `          ... and ${result.chunks.length - 5} more chunks\n`;
      }
    }

    const maxLines = options.maxLines || 500;
    const lines = code.split('\n');
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      output += `        ${String(i + 1).padStart(4, ' ')} │ ${lines[i]}\n`;
    }
    if (lines.length > maxLines) {
      output += `        ... (truncated at ${maxLines} lines)\n`;
    }
  }

  output += '\n\n============================================================\n';
  output += '📊 EXTRACTION SUMMARY\n';
  output += '============================================================\n';
  output += `Files Extracted:  ${formatNumber(summary.totalFiles)}\n`;
  output += `Total Lines:      ${formatNumber(summary.totalLines)}\n`;
  output += `Total Chunks:     ${formatNumber(summary.totalChunks)}\n`;
  output += `Functions Found:  ${formatNumber(summary.totalFunctions)}\n`;
  output += `Classes Found:    ${formatNumber(summary.totalClasses)}\n`;
  output += `Imports Found:    ${formatNumber(summary.totalImports)}\n`;
  output += `Exports Found:    ${formatNumber(summary.totalExports)}\n`;
  output += '============================================================\n';

  return output;
}

// ============================================================
// HELPERS
// ============================================================

function calculateFileScore(result: ParseResult): number {
  let score = 0;
  score += result.exports.length * 15;
  score += result.imports.length * 5;
  score += result.functions.length * 8;
  score += result.classes.length * 10;
  
  if (result.file.endsWith('.ts') || result.file.endsWith('.tsx')) {
    score += 20;
  }
  if (result.file.includes('index.') || result.file.includes('main.')) {
    score += 30;
  }
  
  const lineCount = result.chunks.reduce((sum, c) => 
    sum + c.content.split('\n').length, 0
  );
  score += Math.min(lineCount / 50, 20);
  
  return score;
}

function trimResultsToBudget(
  results: ParseResult[], 
  budget: number
): ParseResult[] {
  const scored = results.map(result => ({
    result,
    score: calculateFileScore(result)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  const trimmed: ParseResult[] = [];
  let tokens = 0;
  
  for (const item of scored) {
    const itemTokens = estimateTokens(JSON.stringify(item.result));
    if (tokens + itemTokens <= budget * 0.8) {
      trimmed.push(item.result);
      tokens += itemTokens;
    }
  }
  
  return trimmed;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  logger.header('🤖 CodeSpit - AI-READY CODE EXTRACTOR WITH AST PARSING');

  const args = process.argv.slice(2);
  const fileArg = args[0];

  // Parse new CLI options
  const entryArg = args.find(a => a.startsWith('--entry='));
  const depthArg = args.find(a => a.startsWith('--depth='));
  const strategyArg = args.find(a => a.startsWith('--strategy='));
  const budgetArg = args.find(a => a.startsWith('--budget='));
  const autoTrim = args.includes('--auto-trim');
  const interactive = args.includes('--interactive');

  const entryFiles = entryArg 
    ? (entryArg.split('=')[1]?.split(',') || ['src/index.ts'])
    : ['src/index.ts'];

  const maxDepth = depthArg 
    ? parseInt(depthArg.split('=')[1] || '3')
    : 3;

  const strategy = strategyArg
    ? (strategyArg.split('=')[1] as 'all' | 'direct' | 'minimal' || 'direct')
    : 'direct';

  const tokenBudget = budgetArg
    ? parseInt(budgetArg.split('=')[1] || '150000')
    : 150000;

  let targetPath = '.';
  let isSingleFile = false;

  if (fileArg) {
    const resolvedPath = path.resolve(fileArg);
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      targetPath = resolvedPath;
      isSingleFile = true;
      logger.success(`📄 Single file mode: ${targetPath}`);
    } else if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      targetPath = resolvedPath;
      isSingleFile = false;
      logger.success(`📂 Directory mode: ${targetPath}`);
    } else {
      logger.error(`Path '${fileArg}' does not exist.`);
      process.exit(1);
    }
  } else {
    while (true) {
      const input = await question('\n📂 Enter file or directory path to extract: ');
      const resolvedInput = path.resolve(input || '.');
      
      if (fs.existsSync(resolvedInput)) {
        targetPath = resolvedInput;
        isSingleFile = fs.statSync(resolvedInput).isFile();
        break;
      }
      logger.error(`Path '${input}' does not exist!`);
    }
  }

  if (isSingleFile) {
    // ─── SINGLE FILE MODE ──────────────────────────────────────
    const modeInput = await question('\n📋 Output mode:\n  1. Full code (with line numbers)\n  2. Compact AST only (recommended, 80% less tokens)\n\nChoose (1 or 2): ');
    const useCompactOutput = modeInput.trim() !== '1';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14);
    const outputFile = `ai_context_${path.basename(targetPath, path.extname(targetPath))}_${timestamp}.txt`;

    logger.info(`🚀 Parsing ${targetPath}...`);

    const options: Partial<ExtractOptions> = {
      maxLines: 500,
      maxChunkTokens: 500,
      overlapLines: 3,
      includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.php', '.json'],
      useCompactOutput,
    };

    try {
      const result = parseSingleFile(targetPath, options);
      const code = fs.readFileSync(targetPath, 'utf-8');
      const output = formatSingleFileOutput(result, options, code, useCompactOutput);

      writeOutputFile(outputFile, output);

      logger.success(`Done!`);
      logger.info(`📄 Output: ${outputFile}`);
      logger.info(`📊 Functions: ${formatNumber(result.functions.length)}`);
      logger.info(`📊 Classes: ${formatNumber(result.classes.length)}`);
      logger.info(`📊 Imports: ${formatNumber(result.imports.length)}`);
      logger.info(`📊 Chunks: ${formatNumber(result.totalChunks)}`);

      console.log('\n' + '─'.repeat(50));
      console.log('📖 Preview (first 20 lines):');
      console.log('─'.repeat(50));
      const preview = output.split('\n').slice(0, 20).join('\n');
      console.log(preview);
      console.log('─'.repeat(50));
      console.log(`💡 Full output saved to: ${outputFile}`);

    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

  } else {
    // ─── DIRECTORY MODE ──────────────────────────────────────
    logger.success(`Target: ${targetPath}`);

    logger.section('Subdirectories found:');
    const subdirs = fs.readdirSync(targetPath)
      .filter(d => fs.statSync(path.join(targetPath, d)).isDirectory())
      .filter(d => !d.startsWith('.'))
      .filter(d => d !== 'node_modules' && d !== '.git');

    subdirs.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d}`);
    });

    const ignoreInput = await question('\nEnter directories to ignore (space separated, or press Enter for none): ');
    const ignoreDirs = ignoreInput ? ignoreInput.split(/\s+/) : [];

    const modeInput = await question('\n📋 Output mode:\n  1. Full code (with line numbers)\n  2. Compact AST only (recommended, 80% less tokens)\n\nChoose (1 or 2): ');
    const useCompactOutput = modeInput.trim() !== '1';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14);
    const outputFile = `ai_context_${timestamp}.txt`;

    logger.info(`🚀 Extracting with AST parsing...`);

    const options: Partial<ExtractOptions> = {
      maxLines: 500,
      maxChunkTokens: 500,
      overlapLines: 3,
      ignoreDirs: ['node_modules', '.git', 'dist', 'build', ...ignoreDirs],
      includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.php', '.json'],
      useCompactOutput,
    };

    // Extract all files first
    const { results, summary } = await extractCodebase(targetPath, options);

    // Check token budget
    const estimatedTokens = estimateTokens(JSON.stringify(results));
    let finalResults = results;

    if (estimatedTokens > tokenBudget) {
      logger.warn(`⚠️ Estimated tokens: ${formatNumber(estimatedTokens)} (Budget: ${formatNumber(tokenBudget)})`);
      
      if (autoTrim) {
        finalResults = trimResultsToBudget(results, tokenBudget);
        logger.info(`✂️ Trimmed to ${finalResults.length} files (from ${results.length})`);
      } else if (interactive) {
        // Interactive selection
        console.log('\n📂 File Selection:');
        console.log('─────────────────────────────────────────────────');
        
        const sortedResults = results.map(r => ({
          result: r,
          score: calculateFileScore(r),
          tokens: estimateTokens(JSON.stringify(r))
        })).sort((a, b) => b.score - a.score);
        
        const displayCount = Math.min(sortedResults.length, 20);
        for (let i = 0; i < displayCount; i++) {
          const file = sortedResults[i];
          if (!file) continue;
          const relPath = getRelativePath(file.result.file, targetPath);
          console.log(`${i + 1}. [${file.tokens} tokens] ${relPath} (score: ${file.score})`);
        }
        
        if (sortedResults.length > 20) {
          console.log(`... and ${sortedResults.length - 20} more files`);
        }
        
        console.log(`\n💡 Total tokens: ${formatNumber(estimatedTokens)}`);
        console.log(`💰 Budget: ${formatNumber(tokenBudget)}\n`);
        
        const selection = await question(
          `Select files to include (e.g., "1,2,5" or "auto" or "all"): `
        );
        
        if (selection === 'auto') {
          finalResults = trimResultsToBudget(results, tokenBudget);
        } else if (selection !== 'all' && selection !== '') {
          const indices = selection.split(',').map(s => parseInt(s.trim()) - 1);
          const selected: ParseResult[] = [];
          for (const idx of indices) {
            if (idx >= 0 && idx < sortedResults.length) {
              const item = sortedResults[idx];
              if (item) {
                selected.push(item.result);
              }
            }
          }
          if (selected.length > 0) {
            finalResults = selected;
          }
        }
      } else {
        // Ask user
        const shouldContinue = await question(
          `\nContinue with all files? (y/n, or 't' to trim): `
        );
        
        if (shouldContinue === 't') {
          finalResults = trimResultsToBudget(results, tokenBudget);
        } else if (shouldContinue !== 'y') {
          process.exit(0);
        }
      }
    }

    // If entry files are specified and we have enough results, use smart context
    const useSmartContext = entryArg && finalResults.length > 0;
    
    if (useSmartContext) {
      logger.info(`🧠 Building dependency-aware context...`);
      
      const builder = new SmartContextBuilder(finalResults);
      
      const context = builder.buildContext({
        entryFiles,
        maxDepth,
        maxTokens: tokenBudget,
        includeExports: true,
        includeFunctions: true,
        includeClasses: true,
        mode: useCompactOutput ? 'compact' : 'full',
        dependencyStrategy: strategy
      });
      
      // Display summary
      logger.info(`📊 Context built with ${context.includedFiles.length} files`);
      logger.info(`💰 Tokens: ${formatNumber(context.tokens)}`);
      
      // Show breakdown
      console.log('\n📊 Token Breakdown:');
      const sortedFiles = Object.entries(context.tokenBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      for (const [file, tokens] of sortedFiles) {
        const relPath = getRelativePath(file, targetPath);
        console.log(`  ${relPath}: ${formatNumber(tokens)} tokens`);
      }
      
      if (Object.keys(context.tokenBreakdown).length > 10) {
        console.log(`  ... and ${Object.keys(context.tokenBreakdown).length - 10} more files`);
      }
      
      // Write output
      writeOutputFile(outputFile, context.context);
      
      logger.success(`Done!`);
      logger.info(`📄 Output: ${outputFile}`);
      
    } else {
      // Use traditional output
      const output = formatDirectoryOutput(finalResults, summary, targetPath, options, useCompactOutput);
      writeOutputFile(outputFile, output);
      
      logger.success(`Done!`);
      logger.info(`📄 Output: ${outputFile}`);
      logger.info(`📊 Files: ${formatNumber(finalResults.length)}`);
      logger.info(`📊 Functions: ${formatNumber(summary.totalFunctions)}`);
      logger.info(`📊 Classes: ${formatNumber(summary.totalClasses)}`);
      logger.info(`📊 Chunks: ${formatNumber(summary.totalChunks)}`);
    }
  }

  rl.close();
}

// Run main
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});