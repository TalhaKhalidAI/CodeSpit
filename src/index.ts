#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { extractCodebase } from './parser/extractor.js';
import { parseFile } from './parser/astParser.js';
import { logger, formatNumber } from './utils/logger.js';
import { getRelativePath, writeOutputFile } from './utils/fileUtils.js';
import { exportCodebaseToImage } from './utils/imageExporter.js';
import type { ExtractOptions, ParseResult } from './types/index.js';

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
  
  // Check if extension is supported
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
// FORMAT SINGLE FILE OUTPUT - REFACTORED
// ============================================================

function buildASTSummary(result: ParseResult): string {
  let output = '';
  output += `        🔬 AST ANALYSIS:\n`;
  output += `        📊 AST Summary:\n`;
  output += `          • Language: ${result.language}\n`;
  output += `          • Functions: ${result.functions.length}\n`;
  output += `          • Classes: ${result.classes.length}\n`;
  output += `          • Imports: ${result.imports.length}\n`;

  // Functions
  if (result.functions.length > 0) {
    output += `        📋 Functions Found:\n`;
    for (const fn of result.functions) {
      output += `          • ${fn.name} (lines ${fn.startLine}-${fn.endLine})\n`;
    }
  }

  // Classes
  if (result.classes.length > 0) {
    output += `        📋 Classes Found:\n`;
    for (const cls of result.classes) {
      output += `          • ${cls.name} (lines ${cls.startLine}-${cls.endLine})\n`;
    }
  }

  // Interfaces
  if (result.interfaces.length > 0) {
    output += `        📋 Interfaces Found:\n`;
    for (const intf of result.interfaces) {
      output += `          • ${intf.name} (lines ${intf.startLine}-${intf.endLine})\n`;
    }
  }

  // Types
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

  // AST Summary
  output += buildASTSummary(result);

  // Chunks
  output += buildChunksOutput(result, useCompactOutput);

  // Full source code (only in FULL mode)
  if (!useCompactOutput) {
    output += buildSourceCodeOutput(code, options);
  }

  // Summary
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

    // AST Summary (without line numbers for compactness)
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

    // Chunks (limited to 5 for directories)
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

    // Full file content
    const maxLines = options.maxLines || 500;
    const lines = code.split('\n');
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      output += `        ${String(i + 1).padStart(4, ' ')} │ ${lines[i]}\n`;
    }
    if (lines.length > maxLines) {
      output += `        ... (truncated at ${maxLines} lines)\n`;
    }
  }

  // Summary
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
// MAIN
// ============================================================

async function main() {
  logger.header('🤖 CodeSpit - AI-READY CODE EXTRACTOR WITH AST PARSING');

  // Check if flags or path passed as argument
  const args = process.argv.slice(2);
  const isImageFlag = args.includes('--image') || args.includes('-i');
  const nonFlagArgs = args.filter(a => !a.startsWith('-'));
  const fileArg = nonFlagArgs[0];

  let targetPath = '.';
  let isSingleFile = false;

  if (fileArg) {
    // Single file mode or specified path
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
    // Interactive mode - ask for directory or file
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

  if (isImageFlag) {
    logger.info(`📸 Dense Code Image Mode requested via flag...`);
    try {
      const result = await exportCodebaseToImage(targetPath);
      logger.success(`Done!`);
      logger.info(`🖼️  Image Saved: ${result.outputPath}`);
      logger.info(`📊 Files Processed: ${formatNumber(result.fileCount)}`);
      logger.info(`📊 Total Lines: ${formatNumber(result.totalLines)}`);
      logger.info(`📊 File Size: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    rl.close();
    return;
  }

  if (isSingleFile) {
    // ─── SINGLE FILE MODE ──────────────────────────────────────
    const modeInput = await question('\n📋 Output mode:\n  1. Full code (with line numbers)\n  2. Compact AST only (recommended, 80% less tokens)\n  3. Dense Code Image (Puppeteer rendering, no AST)\n\nChoose (1, 2, or 3): ');
    const choice = modeInput.trim();

    if (choice === '3') {
      try {
        const result = await exportCodebaseToImage(targetPath);
        logger.success(`Done!`);
        logger.info(`🖼️  Image Saved: ${result.outputPath}`);
        logger.info(`📊 Files Processed: ${formatNumber(result.fileCount)}`);
        logger.info(`📊 Total Lines: ${formatNumber(result.totalLines)}`);
        logger.info(`📊 File Size: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      rl.close();
      return;
    }

    const useCompactOutput = choice !== '1';
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

    const modeInput = await question('\n📋 Output mode:\n  1. Full code (with line numbers)\n  2. Compact AST only (recommended, 80% less tokens)\n  3. Dense Code Image (Puppeteer rendering, no AST)\n\nChoose (1, 2, or 3): ');
    const choice = modeInput.trim();

    if (choice === '3') {
      try {
        const options: Partial<ExtractOptions> = {
          ignoreDirs: ['node_modules', '.git', 'dist', 'build', ...ignoreDirs],
          includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.php', '.json'],
        };
        const result = await exportCodebaseToImage(targetPath, options);
        logger.success(`Done!`);
        logger.info(`🖼️  Image Saved: ${result.outputPath}`);
        logger.info(`📊 Files Processed: ${formatNumber(result.fileCount)}`);
        logger.info(`📊 Total Lines: ${formatNumber(result.totalLines)}`);
        logger.info(`📊 File Size: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      rl.close();
      return;
    }

    const useCompactOutput = choice !== '1';
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

    const { results, summary } = await extractCodebase(targetPath, options);
    const output = formatDirectoryOutput(results, summary, targetPath, options, useCompactOutput);

    writeOutputFile(outputFile, output);

    logger.success(`Done!`);
    logger.info(`📄 Output: ${outputFile}`);
    logger.info(`📊 Files: ${formatNumber(summary.totalFiles)}`);
    logger.info(`📊 Lines: ${formatNumber(summary.totalLines)}`);
    logger.info(`📊 AST Chunks: ${formatNumber(summary.totalChunks)}`);
    logger.info(`📊 Functions: ${formatNumber(summary.totalFunctions)}`);
    logger.info(`📊 Classes: ${formatNumber(summary.totalClasses)}`);

    console.log('\n' + '─'.repeat(50));
    console.log('📖 Preview (first 30 lines):');
    console.log('─'.repeat(50));
    const preview = output.split('\n').slice(0, 30).join('\n');
    console.log(preview);
    console.log('─'.repeat(50));
    console.log(`💡 Full output saved to: ${outputFile}`);
  }

  rl.close();
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});