import { parseArgs } from 'util';

import { Database } from '../lib/db.js';
import { hashPassword } from '../lib/crypto.js';

const db = new Database();

const { values: args } = parseArgs({
  options: {
    username: {
      type: 'string',
      short: 'u',
    },
    password: {
      type: 'string',
      short: 'p',
    },
  },
});

if (!args.username || !args.password) {
  throw new Error('Missing username or password');
}

await db.saveUser({
  username: args.username,
  ...await hashPassword(args.password),
  createdAt: Date.now(),
});
