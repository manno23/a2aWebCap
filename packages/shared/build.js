#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Building shared package for Cloudflare Workers...');

try {
  // Use TypeScript compiler with worker-compatible settings
  execSync('tsc --project tsconfig.json', {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  console.log('✅ Shared package built successfully for Cloudflare Workers!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}