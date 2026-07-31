// src/parser/astParser.ts

import * as ts from 'typescript';
import type { CodeUnit, ParseResult } from '../types/index.js';
import { createSemanticChunks } from './chunket.js';

// ============================================================
// TYPESCRIPT PARSER (Works for .ts, .tsx, .js, .jsx)
// ============================================================

export function parseTypeScriptFile(filePath: string, code: string): ParseResult {
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const imports: CodeUnit[] = [];
  const exportsItems: CodeUnit[] = [];
  const functions: CodeUnit[] = [];
  const classes: CodeUnit[] = [];
  const interfaces: CodeUnit[] = [];
  const types: CodeUnit[] = [];

  function walkNode(node: ts.Node) {
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    const startLine = code.substring(0, start).split('\n').length - 1;
    const endLine = code.substring(0, end).split('\n').length - 1;
    const text = code.substring(start, end);

    if (ts.isImportDeclaration(node)) {
      const fromMatch = text.match(/from\s+['"]([^'"]+)['"]/);
      const from = fromMatch?.[1] ?? 'unknown';
      imports.push({
        type: 'import',
        name: from,
        content: text,
        startLine,
        endLine,
        dependencies: [from],
        exports: [],
      });
    }

    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      const nameMatch = text.match(/export\s+(\w+)/);
      const name = nameMatch?.[1] ?? 'unknown';
      exportsItems.push({
        type: 'export',
        name: name,
        content: text,
        startLine,
        endLine,
        dependencies: [],
        exports: [],
      });
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      functions.push({
        type: 'function',
        name: name,
        content: text,
        startLine,
        endLine,
        dependencies: [],
        exports: [],
      });
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text;
      classes.push({
        type: 'class',
        name: name,
        content: text,
        startLine,
        endLine,
        dependencies: [],
        exports: [],
      });
    }

    if (ts.isInterfaceDeclaration(node) && node.name) {
      const name = node.name.text;
      interfaces.push({
        type: 'interface',
        name: name,
        content: text,
        startLine,
        endLine,
        dependencies: [],
        exports: [],
      });
    }

    if (ts.isTypeAliasDeclaration(node) && node.name) {
      const name = node.name.text;
      types.push({
        type: 'type',
        name: name,
        content: text,
        startLine,
        endLine,
        dependencies: [],
        exports: [],
      });
    }

    ts.forEachChild(node, walkNode);
  }

  walkNode(sourceFile);

  const allUnits = [...imports, ...exportsItems, ...functions, ...classes, ...interfaces, ...types];
  const chunks = createSemanticChunks(allUnits);

  return {
    file: filePath,
    language: filePath.endsWith('.tsx') ? 'TypeScript (TSX)' : 'TypeScript',
    imports,
    exports: exportsItems,
    functions,
    classes,
    interfaces,
    types,
    chunks,
    totalChunks: chunks.length,
    totalItems: allUnits.length,
  };
}

// ============================================================
// PYTHON PARSER (Simple regex-based)
// ============================================================

export function parsePythonFile(filePath: string, code: string): ParseResult {
  const imports: CodeUnit[] = [];
  const functions: CodeUnit[] = [];
  const classes: CodeUnit[] = [];

  const lines = code.split('\n');
  let inFunction = false;
  let functionContent = '';
  let functionName = '';
  let functionStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    
    // Import detection
    if (line.match(/^import\s+\w+/) || line.match(/^from\s+\w+\s+import/)) {
      const nameMatch = line.match(/import\s+(\w+)/);
      imports.push({
        type: 'import',
        name: nameMatch?.[1] ?? 'unknown',
        content: line,
        startLine: i,
        endLine: i,
        dependencies: [],
        exports: [],
      });
    }

    // Function detection
    const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
    if (funcMatch) {
      if (inFunction && functionContent) {
        functions.push({
          type: 'function',
          name: functionName,
          content: functionContent,
          startLine: functionStart,
          endLine: i - 1,
          dependencies: [],
          exports: [],
        });
      }
      inFunction = true;
      functionName = funcMatch[1] ?? 'unknown';
      functionContent = line + '\n';
      functionStart = i;
    } else if (inFunction) {
      functionContent += line + '\n';
      if (line.trim() === '' && i > functionStart + 1) {
        const nextLine = lines[i + 1] || '';
        if (!nextLine.match(/^\s/)) {
          inFunction = false;
          functions.push({
            type: 'function',
            name: functionName,
            content: functionContent,
            startLine: functionStart,
            endLine: i,
            dependencies: [],
            exports: [],
          });
          functionContent = '';
        }
      }
    }

    // Class detection
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      let classContent = line + '\n';
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j] || '';
        if (nextLine.match(/^\s/)) {
          classContent += nextLine + '\n';
          j++;
        } else {
          break;
        }
      }
      classes.push({
        type: 'class',
        name: classMatch[1] ?? 'unknown',
        content: classContent,
        startLine: i,
        endLine: j - 1,
        dependencies: [],
        exports: [],
      });
      i = j - 1;
    }
  }

  // Flush remaining function
  if (inFunction && functionContent) {
    functions.push({
      type: 'function',
      name: functionName,
      content: functionContent,
      startLine: functionStart,
      endLine: lines.length - 1,
      dependencies: [],
      exports: [],
    });
  }

  const allUnits = [...imports, ...functions, ...classes];
  const chunks = createSemanticChunks(allUnits);

  return {
    file: filePath,
    language: 'Python',
    imports,
    exports: [],
    functions,
    classes,
    interfaces: [],
    types: [],
    chunks,
    totalChunks: chunks.length,
    totalItems: allUnits.length,
  };
}

// ============================================================
// MAIN PARSER ENTRY POINT
// ============================================================

export function parseFile(filePath: string, code: string): ParseResult {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  // Python files
  if (ext === 'py' || ext === 'pyi') {
    return parsePythonFile(filePath, code);
  }
  
  // TypeScript/JavaScript files
  return parseTypeScriptFile(filePath, code);
}