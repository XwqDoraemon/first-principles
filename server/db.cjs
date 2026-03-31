const Database = require('better-sqlite3');
const db = new Database('/tmp/fp-db.sqlite3');

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mindmaps (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS usage_counter (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    count INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO usage_counter (id, count) VALUES (1, 0);
`);

module.exports = {
  createConversation(title) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    db.prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(id, title || 'Untitled');
    return id;
  },
  addMessage(conversationId, role, content) {
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conversationId, role, content);
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
  },
  getConversation(id) {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conv) return null;
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(id);
    const mindmap = db.prepare('SELECT * FROM mindmaps WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
    return { ...conv, messages, mindmap };
  },
  saveMindmap(conversationId, data) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    db.prepare('INSERT INTO mindmaps (id, conversation_id, data) VALUES (?, ?, ?)').run(id, conversationId, data);
    return id;
  },
  getConversations() {
    return db.prepare(`
      SELECT c.id, c.title, c.updated_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msg_count
      FROM conversations c ORDER BY c.updated_at DESC
    `).all();
  },
  getUsageCount() {
    const row = db.prepare('SELECT count FROM usage_counter WHERE id = 1').get();
    return row ? row.count : 0;
  },
  updateTitle(id, title) {
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id);
  },
};
