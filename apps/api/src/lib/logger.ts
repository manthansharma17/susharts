import { pino } from 'pino';
import { getEnv } from '../config/env.js';

export const logger = pino({ level: getEnv().LOG_LEVEL });
