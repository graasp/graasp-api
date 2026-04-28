import { getEnv } from './env.js';

getEnv();

export const SHORT_LINK_BASE_URL =
  process.env.SHORT_LINK_BASE_URL ?? 'http://localhost:3000/short-links';
