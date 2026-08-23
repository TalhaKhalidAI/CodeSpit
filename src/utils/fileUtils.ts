// src/utils/fileUtils.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export const findFiles = async (
  rootDir: string,
  extensions: string[],
  ignoreDirs: string[]
): Promise<string[]> => {
  const defaultAlwaysIgnore = [
    'node_modules', 'node-modules', '.git', '.svn', 'dist', 'build',
    '.next', '.nuxt', 'coverage', '.cache', 'vendor', '.pnpm', '.turbo',
    'out', '.output', 'tmp', 'temp', '.venv', 'venv', '__pycache__'
  ];

  const normalizedIgnore = new Set<string>();
  for (const d of [...defaultAlwaysIgnore, ...ignoreDirs]) {
    if (!d) continue;
    normalizedIgnore.add(d);
    normalizedIgnore.add(d.replace(/_/g, '-'));
    normalizedIgnore.add(d.replace(/-/g, '_'));
  }

  const patterns = extensions.map(ext => `${rootDir}/**/*${ext}`);
  const ignorePatterns = Array.from(normalizedIgnore).map(dir => `**/${dir}/**`);

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      ignore: ignorePatterns,
      nodir: true,
      absolute: true,
    });
    files.push(...matches);
  }

  return Array.from(new Set(files));
};

export const readFileContent = (filePath: string): string => {
  return fs.readFileSync(filePath, 'utf-8');
};

export const getFileExtension = (filePath: string): string => {
  return path.extname(filePath).toLowerCase();
};

export const getFileName = (filePath: string): string => {
  return path.basename(filePath);
};

export const getRelativePath = (filePath: string, rootDir: string): string => {
  return path.relative(rootDir, filePath);
};

export const isTypeScriptFile = (filePath: string): boolean => {
  const ext = getFileExtension(filePath);
  return ['.ts', '.tsx'].includes(ext);
};

export const isJavaScriptFile = (filePath: string): boolean => {
  const ext = getFileExtension(filePath);
  return ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);
};

export const isPythonFile = (filePath: string): boolean => {
  return getFileExtension(filePath) === '.py';
};

export const writeOutputFile = (filePath: string, content: string): void => {
  fs.writeFileSync(filePath, content, 'utf-8');
};

export const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};