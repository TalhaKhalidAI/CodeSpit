// src/utils/fileUtils.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export const findFiles = async (
  rootDir: string,
  extensions: string[],
  ignoreDirs: string[]
): Promise<string[]> => {
  const patterns = extensions.map(ext => `${rootDir}/**/*${ext}`);
  const ignorePatterns = ignoreDirs.map(dir => `**/${dir}/**`);

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', ...ignorePatterns],
      nodir: true,
      absolute: true,
    });
    files.push(...matches);
  }

  return files;
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