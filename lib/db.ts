import NativeConstructor from 'better-sqlite3';
import type { Database as Native, Statement } from 'better-sqlite3';

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
  modifiedAt: number;
}>;

export type AuthToken = Readonly<{
  owner: string;
  id: Buffer;
  token: Buffer;
  expiresAt: number;
}>;

export type GetObjectOptions = Readonly<{
  owner: User;
  id: string;
}>;

export type GetObjectsByOwnerOptions = Readonly<{
  owner: User;
  since: number;
}>;

export class Database {
  private readonly db: Native;

  private readonly saveUserStmt: Statement;
  private readonly getUserStmt: Statement;
  private readonly saveObjectStmt: Statement;
  private readonly getObjectStmt: Statement;
  private readonly getObjectsByOwnerStmt: Statement;
  private readonly saveAuthTokenStmt: Statement;
  private readonly getAuthTokenStmt: Statement;
  private readonly deleteAuthTokenStmt: Statement;
  private readonly deleteStaleAuthTokensStmt: Statement;

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
      (owner, id, data, modifiedAt)
      VALUES
      (
        $owner,
        $id,
        $data,
        (SELECT MAX(
          $now,
          IFNULL(
            1 + (SELECT MAX(modifiedAt) FROM objects WHERE owner IS $owner),
            0
          )
        ))
      )
      RETURNING modifiedAt;
    `);

    this.getObjectStmt = db.prepare(`
      SELECT * FROM objects WHERE owner IS $owner AND id IS $id
    `);

    this.getObjectsByOwnerStmt = db.prepare(`
      SELECT * FROM objects
      WHERE owner IS $owner AND modifiedAt > $since
      ORDER BY modifiedAt ASC
    `);

    this.saveAuthTokenStmt = db.prepare(`
      INSERT OR REPLACE INTO authTokens
      (id, owner, token, expiresAt)
      VALUES
      ($id, $owner, $token, $expiresAt)
    `);

    this.getAuthTokenStmt = db.prepare(`
      SELECT * FROM authTokens WHERE id IS $id AND expiresAt > $now
    `);

    this.deleteAuthTokenStmt = db.prepare(`
      DELETE FROM authTokens WHERE id IS $id AND owner IS $owner
    `);

    this.deleteStaleAuthTokensStmt = db.prepare(`
      DELETE FROM authTokens WHERE expiresAt <= $now
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

  public async saveObjects(
    owner: User,
    objects: ReadonlyArray<Omit<StoredObject, 'owner' | 'modifiedAt'>>,
  ): Promise<number> {
    const now = Date.now();

    let maxModifiedAt = now;
    this.db.transaction(() => {
      for (const obj of objects) {
        const {
          modifiedAt,
        } = this.saveObjectStmt.get({ ...obj, owner: owner.username, now });

        maxModifiedAt = Math.max(maxModifiedAt, modifiedAt);
      }
    })();

    return maxModifiedAt;
  }

  public async getObject({
    owner,
    id,
  }: GetObjectOptions): Promise<StoredObject | undefined> {
    return this.getObjectStmt.get({ owner: owner.username, id });
  }

  public async getObjectsByOwner({
    owner,
    since,
  }: GetObjectsByOwnerOptions): Promise<Array<StoredObject>> {
    return this.getObjectsByOwnerStmt.all({ owner: owner.username, since });
  }

  public async saveAuthToken(token: AuthToken): Promise<void> {
    this.saveAuthTokenStmt.run(token);
  }

  public async getAuthToken(id: Buffer): Promise<AuthToken | undefined> {
    return this.getAuthTokenStmt.get({ id, now: Date.now() });
  }

  public async deleteAuthToken(owner: User, id: Buffer): Promise<void> {
    this.deleteAuthTokenStmt.run({ owner: owner.username, id });
  }

  public async deleteStaleAuthTokens(): Promise<void> {
    return this.deleteStaleAuthTokensStmt.get({ now: Date.now() });
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
          modifiedAt INTEGER NON NULL,

          PRIMARY KEY (owner, id),
          UNIQUE (owner, modifiedAt)
        );

        CREATE INDEX object_by_owner ON objects (owner);

        CREATE INDEX object_by_owner_and_modifiedAt
        ON objects (owner, modifiedAt ASC);

        CREATE TABLE authTokens (
          id BLOB NON NULL PRIMARY KEY,
          owner STRING NON NULL REFERENCES users(username) ON DELETE CASCADE,
          token BLOB NON NULL,
          expiresAt INTEGER NON NULL
        );

        CREATE INDEX authToken_by_owner ON authTokens (owner);
        CREATE INDEX authToken_by_expiresAt ON authTokens (expiresAt ASC);
      `);
    },
  ];
}
