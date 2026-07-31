// src/utils/logger.ts

import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.cyan(`ℹ ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`✅ ${msg}`)),
  warn: (msg: string) => console.log(chalk.yellow(`⚠️ ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`❌ ${msg}`)),
  header: (msg: string) => console.log(chalk.blue(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`)),
  section: (msg: string) => console.log(chalk.magenta(`\n📌 ${msg}`)),
  progress: (msg: string) => process.stdout.write(chalk.dim(`\r⏳ ${msg}`)),
};

export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};