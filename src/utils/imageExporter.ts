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
  if (!line.trim()) return '&nbsp;';

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

function generateHtml(files: FileData[], rootDirName: string): string {
  let totalChars = 0;
  const fileBlocks = files.map((file) => {
    totalChars += file.content.length;
    const lineRows = file.lines.map((line, idx) => {
      const lineNum = idx + 1;
      const highlighted = highlightCode(line);
      return `<tr class="line-row"><td class="ln">${lineNum}</td><td class="code-line"><code>${highlighted}</code></td></tr>`;
    }).join('\n');

    return `
      <div class="file-card">
        <div class="file-header">
          <div class="window-dots">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <span class="file-icon">📄</span>
          <span class="file-path">${escapeHtml(file.relPath)}</span>
          <span class="file-badge">${file.lines.length} lines</span>
        </div>
        <div class="file-body">
          <table class="code-table">
            <tbody>
              ${lineRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('\n');

  const charCountFormatted = totalChars.toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CodeSpit PX-Dense Codebase Image</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #0b0e14;
      color: #c9d1d9;
      font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, "Liberation Mono", monospace;
      padding: 24px;
      width: 100%;
      -webkit-font-smoothing: antialiased;
    }
    .header-bar {
      margin-bottom: 20px;
      padding: 16px 22px;
      background: linear-gradient(135deg, #161b22 0%, #0d1117 100%);
      border: 1px solid #30363d;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #58a6ff;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: 0.5px;
    }
    .px-badge {
      background: linear-gradient(90deg, #1f6feb 0%, #8957e5 100%);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 2px 8px rgba(31, 111, 235, 0.4);
    }
    .header-meta {
      font-size: 12px;
      color: #8b949e;
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .meta-pill {
      background: #21262d;
      border: 1px solid #30363d;
      padding: 4px 10px;
      border-radius: 14px;
      color: #c9d1d9;
    }
    .meta-pill strong {
      color: #79c0ff;
    }
    .container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .file-card {
      background-color: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 6px 16px rgba(0,0,0,0.35);
    }
    .file-header {
      background-color: #21262d;
      padding: 10px 16px;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      font-weight: 600;
    }
    .window-dots {
      display: flex;
      gap: 6px;
      margin-right: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-red { background-color: #ff5f56; }
    .dot-yellow { background-color: #ffbd2e; }
    .dot-green { background-color: #27c93f; }

    .file-icon {
      font-size: 13px;
    }
    .file-path {
      color: #79c0ff;
      word-break: break-all;
      font-family: inherit;
    }
    .file-badge {
      margin-left: auto;
      background-color: #30363d;
      color: #8b949e;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .file-body {
      padding: 6px 0;
      overflow-x: auto;
    }
    .code-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      line-height: 1.4;
    }
    .line-row:hover {
      background-color: rgba(110, 118, 129, 0.12);
    }
    .ln {
      width: 48px;
      text-align: right;
      padding: 0 10px;
      color: #484f58;
      user-select: none;
      vertical-align: top;
      border-right: 1px solid #21262d;
      background-color: #161b22;
    }
    .code-line {
      padding: 0 12px;
      white-space: pre;
      vertical-align: top;
      color: #e6edf3;
    }
    code {
      font-family: inherit;
    }

    /* Syntax Highlighting Tokens */
    .syn-keyword { color: #ff7b72; font-weight: 600; }
    .syn-string  { color: #a5d6ff; }
    .syn-number  { color: #79c0ff; }
    .syn-function{ color: #d2a8ff; }
    .syn-comment { color: #8b949e; font-style: italic; }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="header-title">
      <span>🤖 CodeSpit</span>
      <span class="px-badge">PX-Dense Vision Render</span>
    </div>
    <div class="header-meta">
      <span class="meta-pill">Project: <strong>${escapeHtml(rootDirName)}</strong></span>
      <span class="meta-pill">Files: <strong>${files.length}</strong></span>
      <span class="meta-pill">Chars: <strong>${charCountFormatted}</strong></span>
    </div>
  </div>
  <div class="container">
    ${fileBlocks}
  </div>
</body>
</html>
  `;
}

export async function exportCodebaseToImage(
  targetPath: string,
  options: Partial<ExtractOptions> = {},
  imageOptions: ImageExportOptions = {}
): Promise<{ outputPath: string; fileCount: number; totalLines: number; sizeBytes: number }> {
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
  const rootDirName = path.basename(rootDir);

  let totalLines = 0;
  const filesData: FileData[] = [];

  for (const filePath of filesToProcess) {
    const content = readFileContent(filePath);
    const lines = content.split('\n');
    totalLines += lines.length;
    const relPath = isDirectory ? getRelativePath(filePath, rootDir) : path.basename(filePath);
    filesData.push({
      filePath,
      relPath,
      content,
      lines,
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14);
  const defaultFileName = `codebase_dense_${timestamp}.png`;
  const outputPath = imageOptions.outputPath || path.resolve(process.cwd(), defaultFileName);

  logger.info(`🖼️  Generating high-density HTML render for ${filesData.length} files...`);
  const htmlContent = generateHtml(filesData, rootDirName);

  logger.info(`🌐 Launching Puppeteer browser to capture crisp image...`);
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    const deviceScaleFactor = imageOptions.deviceScaleFactor || 2;

    await page.setViewport({
      width: 1400,
      height: 900,
      deviceScaleFactor,
    });

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    logger.info(`📸 Capturing full-page high-res screenshot (scale factor ${deviceScaleFactor}x)...`);
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png',
    });

    const stats = fs.statSync(outputPath);

    return {
      outputPath,
      fileCount: filesData.length,
      totalLines,
      sizeBytes: stats.size,
    };
  } finally {
    await browser.close();
  }
}
