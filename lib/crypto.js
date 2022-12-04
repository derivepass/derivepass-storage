import { randomBytes, pbkdf2, timingSafeEqual, } from 'crypto';
import { promisify } from 'util';
import { PBKDF2_SALT_LEN, PBKDF2_ITERATIONS, PBKDF2_OUTPUT_LEN, PBKDF2_HASH_ALGO, } from './config.js';
export async function hashPassword(password) {
    const salt = randomBytes(PBKDF2_SALT_LEN);
    const iterations = PBKDF2_ITERATIONS;
    const hash = await promisify(pbkdf2)(password, salt, iterations, PBKDF2_OUTPUT_LEN, PBKDF2_HASH_ALGO);
    return {
        salt,
        iterations,
        hash,
    };
}
export async function checkPasswordHash({ salt, iterations, hash: expectedHash, }, password) {
    const actualHash = await promisify(pbkdf2)(password, salt, iterations, expectedHash.length, PBKDF2_HASH_ALGO);
    return timingSafeEqual(expectedHash, actualHash);
}
