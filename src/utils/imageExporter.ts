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
  if (!line.trim()) return ''; // skip blank lines — no empty rows in dense mode

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

// Each file: bold path header + dense word-wrapped codeblock
function buildDenseHtml(files: FileData[]): string {
  const sections: string[] = [];
  for (const file of files) {
    const codeLines: string[] = [];
    for (const line of file.lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const rendered = highlightCode(trimmed);
      if (rendered) codeLines.push(rendered);
    }
    const header = `<div class="fhdr">// ${escapeHtml(file.relPath)}</div>`;
    const body = `<div class="codeblock">${codeLines.join(' ')}</div>`;
    sections.push(header + body);
  }
  return sections.join('');
}

function generateHtml(files: FileData[]): string {
  const fontPx = 8;
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
      font-family: Consolas, 'Courier New', Courier, monospace;
      font-size: ${fontPx}px;
      font-weight: normal;
      line-height: 1.1;
      letter-spacing: 0px;
      word-spacing: 0px;
    }
    .atlas { width: 100%; padding: 2px 3px; }
    /* File path header: clean separation */
    .fhdr {
      display: block;
      width: 100%;
      background: #000000;
      color: #ffffff;
      font-weight: bold;
      padding: 0 2px;
      margin-top: 1px;
      white-space: nowrap;
      overflow: hidden;
    }
    /* Code block: pure black, retains formatting */
    .codeblock {
      display: block;
      width: 100%;
      white-space: pre-wrap;
      word-break: normal;
      overflow-wrap: anywhere;
      line-height: 1.1;
    }
    /* All tokens → pure black, uniform weight */
    .syn-keyword  { color: #000000; font-weight: normal; }
    .syn-string   { color: #000000; }
    .syn-number   { color: #000000; }
    .syn-function { color: #000000; }
    .syn-comment  { color: #000000; }
  </style>
</head>
<body>
  <div class="atlas">${bodyContent}</div>
</body>
</html>`;
}


// ─── Render one page (batch of files) to a single PNG ────────────────────────
async function renderPage(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  pageFiles: FileData[],
  outputPath: string,
  viewportWidth: number,
  deviceScaleFactor: number
): Promise<void> {
  const page = await browser.newPage();
  await page.setViewport({ width: viewportWidth, height: 900, deviceScaleFactor });
  const html = generateHtml(pageFiles);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  try {
    await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
  } catch (err: any) {
    if (err?.message?.includes('Page is too large')) {
      // Fall back to 1x scale — halves physical pixel height
      await page.setViewport({ width: viewportWidth, height: 900, deviceScaleFactor: 1 });
      await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
    } else {
      throw err;
    }
  } finally {
    await page.close();
  }
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

  const viewportWidth = imageOptions.viewportWidth || 800;
  const deviceScaleFactor = imageOptions.deviceScaleFactor || 2;

  // ── Page splitting ──────────────────────────────────────────────────────────
  // Chromium caps screenshots at ~16,384px physical height.
  // At 5px font × 2x scale = 10px/row physical. Word-wrapped code averages
  // ~2-3 rendered rows per source line → safe limit: ~2,000 source lines/page.
  // For very long files, a single file may still be split onto multiple pages.
  const MAX_LINES_PER_PAGE = imageOptions.maxLinesPerPart || 2000;

  const pageGroups: FileData[][] = [];
  let currentGroup: FileData[] = [];
  let currentGroupLines = 0;

  for (const file of filesData) {
    if (currentGroupLines + file.lines.length > MAX_LINES_PER_PAGE && currentGroup.length > 0) {
      pageGroups.push(currentGroup);
      currentGroup = [];
      currentGroupLines = 0;
    }
    currentGroup.push(file);
    currentGroupLines += file.lines.length;
  }
  if (currentGroup.length > 0) pageGroups.push(currentGroup);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14);
  const baseOutputPath = imageOptions.outputPath || path.resolve(process.cwd(), `codebase_dense_${timestamp}.png`);
  const baseName = baseOutputPath.replace(/\.png$/i, '');

  const totalPages = pageGroups.length;
  logger.info(`🖼️  Building ultra-dense atlas: ${filesData.length} files, ${totalLines.toLocaleString()} lines → ${totalPages} page(s)...`);
  logger.info(`🌐 Launching Puppeteer (${viewportWidth}px wide, ${deviceScaleFactor}x scale)...`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const outputPaths: string[] = [];

  try {
    for (let i = 0; i < pageGroups.length; i++) {
      const pagePath = totalPages === 1
        ? `${baseName}.png`
        : `${baseName}_page${String(i + 1).padStart(3, '0')}.png`;

      logger.info(`📸 Page ${i + 1}/${totalPages} → ${path.basename(pagePath)}`);
      await renderPage(browser, pageGroups[i]!, pagePath, viewportWidth, deviceScaleFactor);
      outputPaths.push(pagePath);
    }
  } finally {
    await browser.close();
  }

  const totalSize = outputPaths.reduce((sum, p) => sum + fs.statSync(p).size, 0);
  logger.info(`✅ Saved ${outputPaths.length} image(s). Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  return {
    outputPath: outputPaths[0]!,
    outputPaths,
    fileCount: filesData.length,
    totalLines,
    sizeBytes: totalSize,
  };
}
