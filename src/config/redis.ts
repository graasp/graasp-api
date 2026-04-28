import { getEnv } from './env.js';
import { requiredEnvVar } from './helpers.js';

getEnv();

export const REDIS_CONNECTION = requiredEnvVar('REDIS_CONNECTION');
