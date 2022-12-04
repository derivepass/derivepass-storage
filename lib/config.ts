import { DAY } from './constants.js';

export const DB_PATH = 'db.sqlite';

export const PBKDF2_ITERATIONS = 10000;

export const PBKDF2_SALT_LEN = 32;

export const PBKDF2_HASH_ALGO = 'sha256';

export const PBKDF2_OUTPUT_LEN = 32;

export const AUTH_TOKEN_ID_LEN = 32;

export const AUTH_TOKEN_LEN = 32;

export const AUTH_TOKEN_EXPIRY = 90 * DAY;
