# Arab Online RP Web

This project is a node-powered web shop for Arab Online RP with:
- Discord OAuth login for the whole website
- server-side points system
- referral rewards
- embedded whitelist form inside the website
- static shop categories and payment flow

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in your Discord application credentials.
3. Install dependencies:

```bash
cd web
npm install
```

4. Start the server:

```bash
npm start
```

5. Open `http://localhost:3000` in the browser.

## Discord OAuth

Create a Discord application and set the redirect URI to:

```
http://localhost:3000/auth/callback
```

## Data persistence

User accounts and whitelist submissions are stored in `web/data/users.json` and `web/data/whitelist.json`.
