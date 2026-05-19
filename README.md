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

If you deploy on Vercel, set the callback URL in Discord to your Vercel domain, for example:

```
https://trapliferoleplay.vercel.app/auth/callback
```

Then add the environment variable in Vercel:

- `DISCORD_CALLBACK_URL=https://trapliferoleplay.vercel.app/auth/callback`

Add these additional variables to your `.env` file when using the Discord ticket and Ooredoo email flow:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_TICKET_CATEGORY_ID`
- `DISCORD_SUPPORT_ROLE_ID` (optional)
- `DISCORD_INVITE_URL`
- `PAYMENT_NOTIFICATION_EMAIL`
- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_SECURE`
- `EMAIL_SMTP_USER`
- `EMAIL_SMTP_PASS`
- `EMAIL_SENDER`

## Data persistence

User accounts and whitelist submissions are stored in `web/data/users.json` and `web/data/whitelist.json` when running locally.

> On Vercel, the backend uses an ephemeral `/tmp` data directory, so JSON storage is not persistent between cold starts. For production, use a real database or persistent storage.
