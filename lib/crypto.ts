import {
  randomBytes,
  pbkdf2,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';

import {
  AUTH_TOKEN_ID_LEN,
  AUTH_TOKEN_LEN,
  AUTH_TOKEN_EXPIRY,
  PBKDF2_SALT_LEN,
  PBKDF2_ITERATIONS,
  PBKDF2_OUTPUT_LEN,
  PBKDF2_HASH_ALGO,
} from './config.js';
import type { User, AuthToken } from './db.js';

export type HashedPassword = Readonly<{
  salt: Buffer;
  iterations: number;
  hash: Buffer;
}>;

export async function hashPassword(password: string): Promise<HashedPassword> {
  const salt = randomBytes(PBKDF2_SALT_LEN);
  const iterations = PBKDF2_ITERATIONS;
  const hash = await promisify(pbkdf2)(
    password,
    salt,
    iterations,
    PBKDF2_OUTPUT_LEN,
    PBKDF2_HASH_ALGO,
  );

  return {
    salt,
    iterations,
    hash,
  };
}

export async function checkPasswordHash({
  salt,
  iterations,
  hash: expectedHash,
}: HashedPassword, password: string): Promise<boolean> {
  const actualHash = await promisify(pbkdf2)(
    password,
    salt,
    iterations,
    expectedHash.length,
    PBKDF2_HASH_ALGO,
  );

  return timingSafeEqual(expectedHash, actualHash);
}

export function createAuthToken(user: User): AuthToken {
  return {
    id: randomBytes(AUTH_TOKEN_ID_LEN),
    owner: user.username,
    token: randomBytes(AUTH_TOKEN_LEN),
    expiresAt: Date.now() + AUTH_TOKEN_EXPIRY,
  };
}

export function checkAuthToken(
  { token: expected }: AuthToken,
  actual: Buffer,
): boolean {
  return timingSafeEqual(expected, actual);
}
