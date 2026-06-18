/**
 * Vitest setup: load test environment before any module imports.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.test') });
