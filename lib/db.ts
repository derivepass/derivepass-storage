import NativeConstructor from 'better-sqlite3';
import type { Database as Native, Statement } from 'better-sqlite3';
import { pbkdf2 } from 'crypto';

import { DB_PATH } from './config.js';

export type User = Readonly<{
  username: string;
  hash: Buffer;
  salt: Buffer;
  iterations: number;
  createdAt: number;
}>;

export type StoredObject = Readonly<{
  owner: string;
  id: string;
  data: string;
}>;

export type GetObjectOptions = Readonly<{
  owner: string;
  id: string;
}>;

export class Database {
  private readonly db: Native;

  private readonly saveUserStmt: Statement;
  private readonly getUserStmt: Statement;
  private readonly saveObjectStmt: Statement;
  private readonly getObjectStmt: Statement;
  private readonly getObjectsByOwnerStmt: Statement;

  constructor(path = DB_PATH) {
    const db = new NativeConstructor(path);

    db.pragma('journal_mode = WAL');

    db.transaction(() => {
      const startingVersion = db.pragma('user_version', { simple: true });

      for (const migration of Database.migrations.slice(startingVersion)) {
        migration(db);
      }

      db.pragma(`user_version = ${Database.migrations.length}`);
    })();

    this.db = db;

    this.saveUserStmt = db.prepare(`
      INSERT OR REPLACE INTO users
      (username, hash, salt, iterations, createdAt)
      VALUES
      ($username, $hash, $salt, $iterations, $createdAt)
    `);

    this.getUserStmt = db.prepare(`
      SELECT * FROM users WHERE username IS $username
    `);

    this.saveObjectStmt = db.prepare(`
      INSERT OR REPLACE INTO objects
      (owner, id, data)
      VALUES
      ($owner, $id, $data)
    `);

    this.getObjectStmt = db.prepare(`
      SELECT * FROM objects WHERE owner IS $owner AND id IS $id
    `);

    this.getObjectsByOwnerStmt = db.prepare(`
      SELECT * FROM objects WHERE owner IS $owner
    `);
  }

  public close(): void {
    this.db.close();
  }

  public async saveUser(user: User): Promise<void> {
    this.saveUserStmt.run(user);
  }

  public async getUser(username: string): Promise<User | undefined> {
    return this.getUserStmt.get({ username });
  }

  public async saveObject(obj: StoredObject): Promise<void> {
    this.saveObjectStmt.run(obj);
  }

  public async getObject({
    owner,
    id,
  }: GetObjectOptions): Promise<StoredObject | undefined> {
    return this.getObjectStmt.get({ owner, id });
  }

  public async getObjectsByOwner(
    owner: string,
  ): Promise<ReadonlyArray<StoredObject>> {
    return this.getObjectsByOwnerStmt.all({ owner });
  }

  //
  // Private
  //

  private static migrations: ReadonlyArray<(db: Native) => void> = [
    (db) => {
      db.exec(`
        CREATE TABLE users (
          username STRING NON NULL PRIMARY KEY,
          hash BLOB NON NULL,
          salt BLOB NON NULL,
          iterations INTEGER NON NULL,
          createdAt INTEGER NON NULL
        );

        CREATE TABLE objects (
          owner STRING NON NULL REFERENCES users(username) ON DELETE CASCADE,
          id STRING NON NULL,
          data STRING NON NULL,

          PRIMARY KEY (owner, id)
        );

        CREATE INDEX object_by_owner ON objects (owner);
      `);
    },
  ];
}
