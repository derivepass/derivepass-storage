import NativeConstructor from 'better-sqlite3';
import { DB_PATH } from './config.js';
export class Database {
    db;
    saveUserStmt;
    getUserStmt;
    saveObjectStmt;
    getObjectStmt;
    getObjectsByOwnerStmt;
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
    close() {
        this.db.close();
    }
    async saveUser(user) {
        this.saveUserStmt.run(user);
    }
    async getUser(username) {
        return this.getUserStmt.get({ username });
    }
    async saveObject(obj) {
        this.saveObjectStmt.run(obj);
    }
    async getObject({ owner, id, }) {
        return this.getObjectStmt.get({ owner, id });
    }
    async getObjectsByOwner(owner) {
        return this.getObjectsByOwnerStmt.all({ owner });
    }
    //
    // Private
    //
    static migrations = [
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

        CREATE INDEX object_by_owner (owner);
      `);
        },
    ];
}
