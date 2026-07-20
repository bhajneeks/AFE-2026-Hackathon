const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- Database setup ---
const db = new Database(path.join(__dirname, 'orbit.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    track TEXT DEFAULT 'SDE',
    city TEXT DEFAULT 'Seattle, WA',
    school TEXT DEFAULT '',
    org TEXT DEFAULT '',
    linkedin TEXT DEFAULT '',
    avail TEXT DEFAULT 'coffee',
    new_too INTEGER DEFAULT 1,
    interests TEXT DEFAULT '[]',
    bio TEXT DEFAULT '',
    photo TEXT DEFAULT NULL,
    privacy TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    convo_key TEXT NOT NULL,
    from_id TEXT NOT NULL,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL,
    FOREIGN KEY (from_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(convo_key, ts);

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    emoji TEXT DEFAULT '',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    city TEXT DEFAULT '',
    created_by TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// --- Prepared statements ---
const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (id, name, email, track, city, school, org, linkedin, avail, new_too, interests, bio, photo, privacy)
    VALUES (@id, @name, @email, @track, @city, @school, @org, @linkedin, @avail, @new_too, @interests, @bio, @photo, @privacy)
    ON CONFLICT(id) DO UPDATE SET
      name=@name, email=@email, track=@track, city=@city, school=@school, org=@org,
      linkedin=@linkedin, avail=@avail, new_too=@new_too, interests=@interests, bio=@bio, photo=@photo, privacy=@privacy
  `),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getAllUsers: db.prepare('SELECT * FROM users'),
  insertMessage: db.prepare('INSERT INTO messages (id, convo_key, from_id, text, ts) VALUES (?, ?, ?, ?, ?)'),
  getMessages: db.prepare('SELECT * FROM messages WHERE convo_key = ? ORDER BY ts ASC'),
  getRecentConvos: db.prepare(`
    SELECT convo_key, MAX(ts) as last_ts FROM messages
    WHERE convo_key LIKE ? OR convo_key IN (
      SELECT 'dm:' || CASE WHEN from_id = ? THEN substr(convo_key, 4) ELSE from_id END
      FROM messages WHERE from_id = ? OR convo_key LIKE ?
    )
    GROUP BY convo_key ORDER BY last_ts DESC
  `),
  createGroup: db.prepare('INSERT INTO groups (id, emoji, title, description, city, created_by) VALUES (?, ?, ?, ?, ?, ?)'),
  getGroup: db.prepare('SELECT * FROM groups WHERE id = ?'),
  getAllGroups: db.prepare('SELECT * FROM groups'),
  addGroupMember: db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)'),
  removeGroupMember: db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?'),
  getGroupMembers: db.prepare('SELECT user_id FROM group_members WHERE group_id = ?'),
  getUserGroups: db.prepare('SELECT group_id FROM group_members WHERE user_id = ?'),
};

// --- Seed default groups if empty ---
const groupCount = db.prepare('SELECT COUNT(*) as c FROM groups').get();
if (groupCount.c === 0) {
  const seedGroups = [
    { id: 'g1', emoji: '\u{1F371}', title: 'Seattle AFEs lunch', desc: 'Grab lunch downtown, Thursdays.', city: 'Seattle, WA' },
    { id: 'g2', emoji: '\u{1F3A4}', title: 'HDE interns Q&A', desc: 'HDE-only space to swap portfolio + critique tips.', city: '' },
    { id: 'g3', emoji: '\u{1F4CA}', title: 'First demo prep', desc: 'Practice your first sprint demo, get gentle feedback.', city: '' },
    { id: 'g4', emoji: '\u{1F9CD}', title: 'First-standup brown bag (PT)', desc: 'Pacific-time first-timers: what even is a standup?', city: '' },
  ];
  for (const g of seedGroups) {
    stmts.createGroup.run(g.id, g.emoji, g.title, g.desc, g.city, null);
  }
}

// --- Helper to serialize user for client ---
function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    track: row.track,
    city: row.city,
    school: row.school,
    org: row.org,
    linkedin: row.linkedin,
    avail: row.avail,
    newToo: !!row.new_too,
    interests: JSON.parse(row.interests || '[]'),
    bio: row.bio,
    photo: row.photo,
    privacy: JSON.parse(row.privacy || '{}'),
  };
}

function serializeGroup(row) {
  if (!row) return null;
  const members = stmts.getGroupMembers.all(row.id).map(r => r.user_id);
  return {
    id: row.id,
    emoji: row.emoji,
    title: row.title,
    desc: row.description,
    city: row.city,
    members,
  };
}

// --- Serve static files ---
app.use(express.static(__dirname + '/public'));

// --- Socket.io ---
const onlineUsers = new Map(); // socketId -> userId
const userSockets = new Map(); // userId -> Set<socketId>

io.on('connection', (socket) => {
  let currentUserId = null;

  // --- Auth / Login ---
  socket.on('login', ({ name, email }, ack) => {
    let user = stmts.getUserByEmail.get(email);
    if (user) {
      currentUserId = user.id;
    } else {
      const id = 'u_' + crypto.randomBytes(8).toString('hex');
      stmts.upsertUser.run({
        id, name, email, track: 'SDE', city: 'Seattle, WA', school: '', org: '',
        linkedin: '', avail: 'coffee', new_too: 1, interests: '[]', bio: '', photo: null,
        privacy: JSON.stringify({ onMap: true, city: true, office: true, school: true, interests: true, linkedin: true, email: true, availability: true }),
      });
      user = stmts.getUserById.get(id);
      currentUserId = id;
    }

    onlineUsers.set(socket.id, currentUserId);
    if (!userSockets.has(currentUserId)) userSockets.set(currentUserId, new Set());
    userSockets.get(currentUserId).add(socket.id);

    // Join rooms for all groups user is in
    const userGroupRows = stmts.getUserGroups.all(currentUserId);
    for (const r of userGroupRows) {
      socket.join('grp:' + r.group_id);
    }

    ack({ user: serializeUser(user) });
  });

  // --- Save/update profile ---
  socket.on('saveProfile', (data, ack) => {
    if (!currentUserId) return;
    stmts.upsertUser.run({
      id: currentUserId,
      name: data.name,
      email: data.email,
      track: data.track,
      city: data.city,
      school: data.school || '',
      org: data.org || '',
      linkedin: data.linkedin || '',
      avail: data.avail,
      new_too: data.newToo ? 1 : 0,
      interests: JSON.stringify(data.interests || []),
      bio: data.bio || '',
      photo: data.photo || null,
      privacy: JSON.stringify(data.privacy || {}),
    });
    const updated = serializeUser(stmts.getUserById.get(currentUserId));
    io.emit('userUpdated', updated);
    if (ack) ack({ user: updated });
  });

  // --- Get all users (for the directory) ---
  socket.on('getUsers', (_, ack) => {
    const users = stmts.getAllUsers.all().map(serializeUser);
    ack(users);
  });

  // --- Get all groups ---
  socket.on('getGroups', (_, ack) => {
    const groups = stmts.getAllGroups.all().map(serializeGroup);
    ack(groups);
  });

  // --- Send a DM ---
  socket.on('sendDM', ({ toId, text }) => {
    if (!currentUserId || !text?.trim()) return;
    const msgId = 'm_' + crypto.randomBytes(8).toString('hex');
    const ts = Date.now();
    const convoKey = dmConvoKey(currentUserId, toId);
    stmts.insertMessage.run(msgId, convoKey, currentUserId, text.trim(), ts);

    const msg = { id: msgId, convoKey, from: currentUserId, text: text.trim(), ts };

    // Send to recipient
    const recipientSockets = userSockets.get(toId);
    if (recipientSockets) {
      for (const sid of recipientSockets) {
        io.to(sid).emit('newMessage', msg);
      }
    }
    // Echo back to sender (all their tabs)
    const senderSockets = userSockets.get(currentUserId);
    if (senderSockets) {
      for (const sid of senderSockets) {
        io.to(sid).emit('newMessage', msg);
      }
    }
  });

  // --- Send a group message ---
  socket.on('sendGroupMessage', ({ groupId, text }) => {
    if (!currentUserId || !text?.trim()) return;
    const msgId = 'm_' + crypto.randomBytes(8).toString('hex');
    const ts = Date.now();
    const convoKey = 'grp:' + groupId;
    stmts.insertMessage.run(msgId, convoKey, currentUserId, text.trim(), ts);

    const msg = { id: msgId, convoKey, from: currentUserId, text: text.trim(), ts };
    io.to(convoKey).emit('newMessage', msg);
  });

  // --- Get message history for a convo ---
  socket.on('getMessages', ({ convoKey }, ack) => {
    if (!currentUserId) return;
    // For DMs, normalize the key
    let key = convoKey;
    if (convoKey.startsWith('dm:')) {
      const peerId = convoKey.slice(3);
      key = dmConvoKey(currentUserId, peerId);
    }
    const rows = stmts.getMessages.all(key);
    const messages = rows.map(r => ({ id: r.id, convoKey: r.convo_key, from: r.from_id, text: r.text, ts: r.ts }));
    ack(messages);
  });

  // --- Get user's conversations list ---
  socket.on('getConversations', (_, ack) => {
    if (!currentUserId) return ack([]);

    // Find all DM convo keys involving this user
    const allMsgs = db.prepare(`
      SELECT DISTINCT convo_key FROM messages
      WHERE (convo_key LIKE 'dm:%' AND (from_id = ? OR convo_key LIKE ?))
         OR convo_key IN (SELECT 'grp:' || group_id FROM group_members WHERE user_id = ?)
    `).all(currentUserId, `%${currentUserId}%`, currentUserId);

    const convos = [];
    for (const { convo_key } of allMsgs) {
      // For DMs, check this user is actually part of the convo
      if (convo_key.startsWith('dm:')) {
        const parts = convo_key.slice(3).split(':');
        if (!parts.includes(currentUserId)) continue;
      }
      const lastMsg = db.prepare('SELECT * FROM messages WHERE convo_key = ? ORDER BY ts DESC LIMIT 1').get(convo_key);
      if (lastMsg) {
        convos.push({ convoKey: convo_key, lastMessage: { from: lastMsg.from_id, text: lastMsg.text, ts: lastMsg.ts } });
      }
    }
    convos.sort((a, b) => b.lastMessage.ts - a.lastMessage.ts);
    ack(convos);
  });

  // --- Join a group ---
  socket.on('joinGroup', ({ groupId }, ack) => {
    if (!currentUserId) return;
    stmts.addGroupMember.run(groupId, currentUserId);
    socket.join('grp:' + groupId);
    const group = serializeGroup(stmts.getGroup.get(groupId));
    io.emit('groupUpdated', group);
    if (ack) ack(group);
  });

  // --- Create a group ---
  socket.on('createGroup', ({ emoji, title, desc, city }, ack) => {
    if (!currentUserId) return;
    const id = 'g_' + crypto.randomBytes(6).toString('hex');
    stmts.createGroup.run(id, emoji || '', title, desc || '', city || '', currentUserId);
    stmts.addGroupMember.run(id, currentUserId);
    socket.join('grp:' + id);
    const group = serializeGroup(stmts.getGroup.get(id));
    io.emit('groupCreated', group);
    if (ack) ack(group);
  });

  // --- Typing indicator ---
  socket.on('typing', ({ convoKey }) => {
    if (!currentUserId) return;
    if (convoKey.startsWith('grp:')) {
      socket.to(convoKey).emit('userTyping', { convoKey, userId: currentUserId });
    } else if (convoKey.startsWith('dm:')) {
      const peerId = convoKey.slice(3);
      const recipientSockets = userSockets.get(peerId);
      if (recipientSockets) {
        for (const sid of recipientSockets) {
          if (sid !== socket.id) io.to(sid).emit('userTyping', { convoKey, userId: currentUserId });
        }
      }
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    if (currentUserId && userSockets.has(currentUserId)) {
      userSockets.get(currentUserId).delete(socket.id);
      if (userSockets.get(currentUserId).size === 0) userSockets.delete(currentUserId);
    }
  });
});

// Consistent DM convo key: always sort the two IDs so both sides use the same key
function dmConvoKey(a, b) {
  return 'dm:' + [a, b].sort().join(':');
}

server.listen(PORT, () => {
  console.log(`Orbit server running at http://localhost:${PORT}`);
});
