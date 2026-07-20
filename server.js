const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3000;

// --- DynamoDB setup ---
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const USERS_TABLE = 'orbit_users';
const MESSAGES_TABLE = 'orbit_messages';
const GROUPS_TABLE = 'orbit_groups';

// --- DB helpers ---
async function getUserByEmail(email) {
  const resp = await ddb.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :e',
    ExpressionAttributeValues: { ':e': email },
    Limit: 1,
  }));
  return resp.Items?.[0] || null;
}

async function getUserById(id) {
  const resp = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { id } }));
  return resp.Item || null;
}

async function getAllUsers() {
  const resp = await ddb.send(new ScanCommand({ TableName: USERS_TABLE }));
  return resp.Items || [];
}

async function putUser(user) {
  await ddb.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));
}

async function getMessages(convoKey, limit = 100) {
  const resp = await ddb.send(new QueryCommand({
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: 'convo_key = :ck',
    ExpressionAttributeValues: { ':ck': convoKey },
    ScanIndexForward: true,
    Limit: limit,
  }));
  return resp.Items || [];
}

async function putMessage(msg) {
  await ddb.send(new PutCommand({ TableName: MESSAGES_TABLE, Item: msg }));
}

async function getGroup(id) {
  const resp = await ddb.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { id } }));
  return resp.Item || null;
}

async function getAllGroups() {
  const resp = await ddb.send(new ScanCommand({ TableName: GROUPS_TABLE }));
  return resp.Items || [];
}

async function putGroup(group) {
  await ddb.send(new PutCommand({ TableName: GROUPS_TABLE, Item: group }));
}

// --- Seed default groups if needed ---
async function seedGroups() {
  const existing = await getAllGroups();
  if (existing.length > 0) return;

  const defaults = [
    { id: 'g1', emoji: '\u{1F371}', title: 'Seattle AFEs lunch', desc: 'Grab lunch downtown, Thursdays.', city: 'Seattle, WA', members: [] },
    { id: 'g2', emoji: '\u{1F3A4}', title: 'HDE interns Q&A', desc: 'HDE-only space to swap portfolio + critique tips.', city: '', members: [] },
    { id: 'g3', emoji: '\u{1F4CA}', title: 'First demo prep', desc: 'Practice your first sprint demo, get gentle feedback.', city: '', members: [] },
    { id: 'g4', emoji: '\u{1F9CD}', title: 'First-standup brown bag (PT)', desc: 'Pacific-time first-timers: what even is a standup?', city: '', members: [] },
  ];
  for (const g of defaults) {
    await putGroup(g);
  }
  console.log('Seeded default groups.');
}

// --- Consistent DM convo key ---
function dmConvoKey(a, b) {
  return 'dm:' + [a, b].sort().join(':');
}

// --- Serve static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Socket.io ---
const onlineUsers = new Map(); // socketId -> userId
const userSockets = new Map(); // userId -> Set<socketId>

io.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('login', async ({ name, email }, ack) => {
    try {
      let user = await getUserByEmail(email);
      if (user) {
        currentUserId = user.id;
      } else {
        const id = 'u_' + crypto.randomBytes(8).toString('hex');
        user = {
          id, name, email, track: 'SDE', city: 'Seattle, WA', school: '', org: '',
          linkedin: '', avail: 'coffee', newToo: true, interests: [], bio: '', photo: null,
          privacy: { onMap: true, city: true, office: true, school: true, interests: true, linkedin: true, email: true, availability: true },
          createdAt: Date.now(),
        };
        await putUser(user);
        currentUserId = id;
        io.emit('userUpdated', user);
      }

      onlineUsers.set(socket.id, currentUserId);
      if (!userSockets.has(currentUserId)) userSockets.set(currentUserId, new Set());
      userSockets.get(currentUserId).add(socket.id);

      // Join group rooms
      const groups = await getAllGroups();
      for (const g of groups) {
        if (g.members && g.members.includes(currentUserId)) {
          socket.join('grp:' + g.id);
        }
      }

      ack({ user });
    } catch (e) {
      console.error('Login error:', e);
      ack({ error: 'Login failed' });
    }
  });

  socket.on('saveProfile', async (data, ack) => {
    if (!currentUserId) return;
    try {
      const user = {
        id: currentUserId,
        name: data.name,
        email: data.email,
        track: data.track,
        city: data.city,
        school: data.school || '',
        org: data.org || '',
        linkedin: data.linkedin || '',
        avail: data.avail,
        newToo: !!data.newToo,
        interests: data.interests || [],
        bio: data.bio || '',
        photo: data.photo || null,
        privacy: data.privacy || {},
      };
      await putUser(user);
      io.emit('userUpdated', user);
      if (ack) ack({ user });
    } catch (e) {
      console.error('SaveProfile error:', e);
    }
  });

  socket.on('getUsers', async (_, ack) => {
    try {
      const users = await getAllUsers();
      ack(users);
    } catch (e) {
      console.error('GetUsers error:', e);
      ack([]);
    }
  });

  socket.on('getGroups', async (_, ack) => {
    try {
      const groups = await getAllGroups();
      ack(groups);
    } catch (e) {
      console.error('GetGroups error:', e);
      ack([]);
    }
  });

  socket.on('sendDM', async ({ toId, text }) => {
    if (!currentUserId || !text?.trim()) return;
    try {
      const ts = Date.now();
      const convoKey = dmConvoKey(currentUserId, toId);
      const msg = { convo_key: convoKey, ts, id: 'm_' + crypto.randomBytes(8).toString('hex'), from: currentUserId, text: text.trim() };
      await putMessage(msg);

      const outMsg = { id: msg.id, convoKey, from: currentUserId, text: text.trim(), ts };

      // Send to recipient
      const recipientSockets = userSockets.get(toId);
      if (recipientSockets) {
        for (const sid of recipientSockets) io.to(sid).emit('newMessage', outMsg);
      }
      // Echo to sender
      const senderSockets = userSockets.get(currentUserId);
      if (senderSockets) {
        for (const sid of senderSockets) io.to(sid).emit('newMessage', outMsg);
      }
    } catch (e) {
      console.error('SendDM error:', e);
    }
  });

  socket.on('sendGroupMessage', async ({ groupId, text }) => {
    if (!currentUserId || !text?.trim()) return;
    try {
      const ts = Date.now();
      const convoKey = 'grp:' + groupId;
      const msg = { convo_key: convoKey, ts, id: 'm_' + crypto.randomBytes(8).toString('hex'), from: currentUserId, text: text.trim() };
      await putMessage(msg);

      const outMsg = { id: msg.id, convoKey, from: currentUserId, text: text.trim(), ts };
      io.to(convoKey).emit('newMessage', outMsg);
    } catch (e) {
      console.error('SendGroupMessage error:', e);
    }
  });

  socket.on('getMessages', async ({ convoKey }, ack) => {
    if (!currentUserId) return ack([]);
    try {
      let key = convoKey;
      if (convoKey.startsWith('dm:') && !convoKey.includes(':' + currentUserId)) {
        const peerId = convoKey.slice(3);
        key = dmConvoKey(currentUserId, peerId);
      } else if (convoKey.startsWith('dm:') && convoKey.split(':').length === 2) {
        const peerId = convoKey.slice(3);
        key = dmConvoKey(currentUserId, peerId);
      }
      const rows = await getMessages(key);
      const messages = rows.map(r => ({ id: r.id, convoKey: r.convo_key, from: r.from, text: r.text, ts: r.ts }));
      ack(messages);
    } catch (e) {
      console.error('GetMessages error:', e);
      ack([]);
    }
  });

  socket.on('getConversations', async (_, ack) => {
    if (!currentUserId) return ack([]);
    // For now, client tracks conversations locally; server provides message history on demand
    ack([]);
  });

  socket.on('joinGroup', async ({ groupId }, ack) => {
    if (!currentUserId) return;
    try {
      const group = await getGroup(groupId);
      if (!group) return ack(null);
      if (!group.members) group.members = [];
      if (!group.members.includes(currentUserId)) {
        group.members.push(currentUserId);
        await putGroup(group);
      }
      socket.join('grp:' + groupId);
      io.emit('groupUpdated', group);
      if (ack) ack(group);
    } catch (e) {
      console.error('JoinGroup error:', e);
    }
  });

  socket.on('createGroup', async ({ emoji, title, desc, city }, ack) => {
    if (!currentUserId) return;
    try {
      const id = 'g_' + crypto.randomBytes(6).toString('hex');
      const group = { id, emoji: emoji || '', title, desc: desc || '', city: city || '', members: [currentUserId], createdBy: currentUserId };
      await putGroup(group);
      socket.join('grp:' + id);
      io.emit('groupCreated', group);
      if (ack) ack(group);
    } catch (e) {
      console.error('CreateGroup error:', e);
    }
  });

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

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    if (currentUserId && userSockets.has(currentUserId)) {
      userSockets.get(currentUserId).delete(socket.id);
      if (userSockets.get(currentUserId).size === 0) userSockets.delete(currentUserId);
    }
  });
});

// --- Start ---
seedGroups().then(() => {
  server.listen(PORT, () => {
    console.log(`Orbit server running at http://localhost:${PORT}`);
  });
}).catch(e => {
  console.error('Failed to seed groups:', e);
  process.exit(1);
});
