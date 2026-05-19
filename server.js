const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const WHITELIST_FILE = path.join(DATA_DIR, 'whitelist.json');
const REDEEMED_FILE = path.join(DATA_DIR, 'redeemed_codes.json');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1360347472844689571';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'Ji0Sr86J71KDhmDw8Ynj3OL0HXRnD3eU';
const DISCORD_REDIRECT_URI = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'Kx92!aPz_DevServer_2026_SECRET';

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}), 'utf-8');
  if (!fs.existsSync(WHITELIST_FILE)) fs.writeFileSync(WHITELIST_FILE, JSON.stringify([]), 'utf-8');
  if (!fs.existsSync(REDEEMED_FILE)) fs.writeFileSync(REDEEMED_FILE, JSON.stringify([]), 'utf-8');
}

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8') || '';
    if (!raw) return filePath === WHITELIST_FILE || filePath === REDEEMED_FILE ? [] : {};
    return JSON.parse(raw);
  } catch (e) {
    if (filePath === WHITELIST_FILE || filePath === REDEEMED_FILE) return [];
    return {};
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

ensureDataFiles();

app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function buildDiscordAuthUrl() {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify'
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

app.get('/auth/discord', (req, res) => {
  if (req.query.next) req.session.next = req.query.next;
  return res.redirect(buildDiscordAuthUrl());
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/?auth_error=missing_code');

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
        scope: 'identify'
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('Discord token error', tokenData);
      return res.redirect('/?auth_error=token_failed');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const user = await userResponse.json();
    if (!user || !user.id) {
      console.error('Discord user fetch failed', user);
      return res.redirect('/?auth_error=user_failed');
    }

    const users = loadJson(USERS_FILE);
    const userKey = user.id;
    const username = `${user.username}#${user.discriminator}`;
    const isNew = !users[userKey];

    if (!users[userKey]) {
      users[userKey] = { id: userKey, username, points: 50, createdAt: new Date().toISOString(), avatar: user.avatar || null };
    } else {
      users[userKey].username = username;
      users[userKey].avatar = user.avatar || users[userKey].avatar || null;
    }

    if (isNew && req.session.pendingRef && req.session.pendingRef !== userKey && users[req.session.pendingRef]) {
      users[req.session.pendingRef].points = (users[req.session.pendingRef].points || 0) + 100;
      req.session.pendingRef = null;
    }

    saveJson(USERS_FILE, users);
    req.session.userId = userKey;
    const redirectTo = req.session.next || '/';
    req.session.next = null;
    return res.redirect(redirectTo);
  } catch (error) {
    console.error(error);
    return res.redirect('/?auth_error=exception');
  }
});

app.get('/api/session', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.json({ authenticated: false });
  const users = loadJson(USERS_FILE);
  const user = users[userId];
  if (!user) return res.json({ authenticated: false });
  const avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;
  const ownerId = process.env.OWNER_ID || null;
  const isOwner = ownerId && ownerId === user.id;
  return res.json({ authenticated: true, user: { id: user.id, username: user.username, points: user.points, avatar, gameAccount: user.gameAccount || null, isOwner } });
});

// Redeem an Ooredoo card code to add points to the user's account
app.post('/api/redeem-ooredoo', (req, res) => {
  const { code, points } = req.body;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!code || !points) return res.status(400).json({ error: 'Missing code or points' });
  const pts = Number(points);
  if (isNaN(pts) || pts <= 0) return res.status(400).json({ error: 'Invalid points value' });

  const redeemed = loadJson(REDEEMED_FILE);
  if (redeemed.find(r => r.code === code)) return res.status(400).json({ error: 'Code already redeemed' });

  const users = loadJson(USERS_FILE);
  const user = users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.points = (user.points || 0) + pts;
  redeemed.push({ code, by: userId, points: pts, at: new Date().toISOString() });
  saveJson(USERS_FILE, users);
  saveJson(REDEEMED_FILE, redeemed);
  return res.json({ ok: true, points: user.points });
});

// Link a game account to receive bonus points
app.post('/api/link-game', (req, res) => {
  const { gameName } = req.body;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!gameName || typeof gameName !== 'string') return res.status(400).json({ error: 'Invalid game name' });
  const users = loadJson(USERS_FILE);
  const user = users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.gameAccount) return res.status(400).json({ error: 'Game account already linked' });
  user.gameAccount = gameName;
  user.points = (user.points || 0) + 250;
  saveJson(USERS_FILE, users);
  return res.json({ ok: true, points: user.points, gameAccount: user.gameAccount });
});

// Owner-only: grant large test points (requires OWNER_ID env var)
app.post('/api/grant-owner-points', (req, res) => {
  const ownerId = process.env.OWNER_ID;
  const userId = req.session.userId;
  if (!ownerId) return res.status(400).json({ error: 'Owner not configured' });
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (userId !== ownerId) return res.status(403).json({ error: 'Forbidden' });
  const users = loadJson(USERS_FILE);
  const user = users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.points = 100000;
  saveJson(USERS_FILE, users);
  return res.json({ ok: true, points: user.points });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/track-ref', (req, res) => {
  const ref = req.query.ref;
  if (ref) {
    req.session.pendingRef = ref;
  }
  res.json({ ok: true });
});

app.post('/api/buy-points', (req, res) => {
  const { itemName, cost } = req.body;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const users = loadJson(USERS_FILE);
  const user = users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const parsedCost = Number(cost);
  if (isNaN(parsedCost) || parsedCost <= 0) return res.status(400).json({ error: 'Invalid cost' });
  if (user.points < parsedCost) return res.status(400).json({ error: 'Insufficient points' });
  user.points -= parsedCost;
  saveJson(USERS_FILE, users);
  return res.json({ ok: true, points: user.points, itemName });
});

app.post('/api/whitelist', (req, res) => {
  const { name, discord, reason, email } = req.body;
  if (!name || !discord || !reason) return res.status(400).json({ error: 'Missing required fields' });
  const entries = loadJson(WHITELIST_FILE);
  entries.push({ name, discord, email: email || '', reason, submittedAt: new Date().toISOString() });
  saveJson(WHITELIST_FILE, entries);
  return res.json({ ok: true });
});

app.get('/api/invite-link', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const users = loadJson(USERS_FILE);
  const user = users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const link = `${req.protocol}://${req.get('host')}/?ref=${encodeURIComponent(user.id)}`;
  res.json({ ok: true, link });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
