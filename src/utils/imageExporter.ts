// src/utils/imageExporter.ts

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { findFiles, readFileContent, getRelativePath } from './fileUtils.js';
import { logger } from './logger.js';
import type { ExtractOptions, ImageExportOptions } from '../types/index.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface FileData {
  filePath: string;
  relPath: string;
  content: string;
  lines: string[];
}

function highlightCode(line: string): string {
  if (!line.trim()) return ''; // skip blank lines entirely

  const placeholders: string[] = [];
  const pushPlaceholder = (html: string) => {
    placeholders.push(html);
    return `___PH_${placeholders.length - 1}___`;
  };

  let escaped = escapeHtml(line);

  // 1. Comments
  const commentMatch = escaped.match(/(\/\/[^\n]*|\#[^\n]*|\/\*.*?\*\/)/);
  let commentStr = '';
  if (commentMatch && commentMatch.index !== undefined) {
    const idx = commentMatch.index;
    commentStr = escaped.slice(idx);
    escaped = escaped.slice(0, idx);
  }

  // 2. Strings
  escaped = escaped.replace(/(&quot;.*?[^\\]&quot;|&quot;&quot;|&#039;.*?[^\\]&#039;|&#039;&#039;|`.*?[^\\]`|``)/g, (m) => {
    return pushPlaceholder(`<span class="syn-string">${m}</span>`);
  });

  // 3. Keywords
  const keywords = 'import|export|from|default|const|let|var|function|async|await|return|if|else|for|while|switch|case|break|class|extends|interface|type|try|catch|throw|new|def|self|public|private|readonly|of|in|void|boolean|string|number';
  escaped = escaped.replace(new RegExp(`\\b(${keywords})\\b`, 'g'), (m) => {
    return pushPlaceholder(`<span class="syn-keyword">${m}</span>`);
  });

  // 4. Numbers & Booleans
  escaped = escaped.replace(/\b(\d+\.?\d*|true|false|null|undefined)\b/g, (m) => {
    return pushPlaceholder(`<span class="syn-number">${m}</span>`);
  });

  // 5. Function calls
  escaped = escaped.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/g, (m) => {
    return pushPlaceholder(`<span class="syn-function">${m}</span>`);
  });

  // Re-attach comment
  if (commentStr) {
    escaped += pushPlaceholder(`<span class="syn-comment">${commentStr}</span>`);
  }

  // Restore placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const val = placeholders[i] || '';
    escaped = escaped.replace(`___PH_${i}___`, val);
  }

  return escaped;
}

// Each file: bold path header row + dense word-wrapped code block below it.
// This gives pxpipe-style file separators with maximum code density.
function buildDenseHtml(files: FileData[]): string {
  const sections: string[] = [];
  for (const file of files) {
    const codeLines: string[] = [];
    for (const line of file.lines) {
      const rendered = highlightCode(line);
      if (rendered) codeLines.push(rendered);
    }
    // File path header: always visible, bold
    const header = `<div class="fhdr">// ${escapeHtml(file.relPath)}</div>`;
    // Dense code block: word-wrap fills every pixel
    const body = `<div class="codeblock">${codeLines.join(' ')}</div>`;
    sections.push(header + body);
  }
  return sections.join('');
}

function generateHtml(files: FileData[]): string {
  const fontPx = 5;
  const bodyContent = buildDenseHtml(files);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CodeSpit Dense Atlas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontPx}px;
      line-height: 1.1;
      -webkit-font-smoothing: none;
      text-rendering: optimizeSpeed;
    }
    .atlas { width: 100%; padding: 3px; }
    /* File path: full-width bold header, clearly readable */
    .fhdr {
      display: block;
      width: 100%;
      color: #000000;
      font-weight: bold;
      background: #e8e8e8;
      padding: 0 2px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
    }
    /* Code block: word-wrap fills entire width, zero gaps */
    .codeblock {
      display: block;
      width: 100%;
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: anywhere;
      line-height: 1.0;
    }
    /* High-contrast black-on-white tokens for AI readability */
    .syn-keyword  { color: #000000; font-weight: bold; }
    .syn-string   { color: #00008b; }
    .syn-number   { color: #004400; }
    .syn-function { color: #4b0000; }
    .syn-comment  { color: #555555; }
  </style>
</head>
<body>
  <div class="atlas">${bodyContent}</div>
</body>
</html>`;
}

export async function exportCodebaseToImage(
  targetPath: string,
  options: Partial<ExtractOptions> = {},
  imageOptions: ImageExportOptions = {}
): Promise<{ outputPath: string; outputPaths: string[]; fileCount: number; totalLines: number; sizeBytes: number }> {
  const isDirectory = fs.statSync(targetPath).isDirectory();
  let filesToProcess: string[] = [];

  if (isDirectory) {
    const includeExtensions = options.includeExtensions || ['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.php', '.json', '.md'];
    const ignoreDirs = options.ignoreDirs || ['node_modules', '.git', 'dist', 'build'];
    filesToProcess = await findFiles(targetPath, includeExtensions, ignoreDirs);
  } else {
    filesToProcess = [targetPath];
  }

  if (filesToProcess.length === 0) {
    throw new Error(`No files found to export to image in '${targetPath}'`);
  }

  const rootDir = isDirectory ? targetPath : path.dirname(targetPath);

  let totalLines = 0;
  const filesData: FileData[] = [];

  for (const filePath of filesToProcess) {
    const content = readFileContent(filePath);
    const lines = content.split('\n');
    totalLines += lines.length;
    const relPath = isDirectory ? getRelativePath(filePath, rootDir) : path.basename(filePath);
    filesData.push({ filePath, relPath, content, lines });
  }

  // 800px wide: lines wrap frequently, creating dense rows like pxpipe's page format
  const viewportWidth = imageOptions.viewportWidth || 800;
  const deviceScaleFactor = imageOptions.deviceScaleFactor || 2;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14);
  const outputPath = imageOptions.outputPath || path.resolve(process.cwd(), `codebase_dense_${timestamp}.png`);

  logger.info(`🖼️  Building ultra-dense wall: ${filesData.length} files, ${totalLines.toLocaleString()} lines...`);
  logger.info(`🌐 Launching Puppeteer (${viewportWidth}px wide, ${deviceScaleFactor}x scale)...`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: viewportWidth, height: 900, deviceScaleFactor });

    const htmlContent = generateHtml(filesData);
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    logger.info(`📸 Capturing ultra-dense wall (${viewportWidth}px, ${deviceScaleFactor}x)...`);

    try {
      await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
    } catch (err: any) {
      if (err?.message?.includes('Page is too large')) {
        logger.warn(`⚠️ Canvas overflow at ${deviceScaleFactor}x — retrying at 1x...`);
        await page.setViewport({ width: viewportWidth, height: 900, deviceScaleFactor: 1 });
        await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
      } else {
        throw err;
      }
    }

    await page.close();
    const stats = fs.statSync(outputPath);

    return {
      outputPath,
      outputPaths: [outputPath],
      fileCount: filesData.length,
      totalLines,
      sizeBytes: stats.size,
    };
  } finally {
    await browser.close();
  }
}
