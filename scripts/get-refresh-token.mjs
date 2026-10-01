#!/usr/bin/env node
/**
 * One-time helper to obtain a Google OAuth 2.0 REFRESH TOKEN for the wedding
 * Drive account. Run locally only. The token it prints goes into Vercel as
 * GOOGLE_REFRESH_TOKEN (and your local .env for dev).
 *
 * Prereqs:
 *   1. In Google Cloud Console, enable the Google Drive API.
 *   2. Create an OAuth client ID of type "Web application".
 *   3. Add http://localhost:4567/oauth2callback as an authorized redirect URI.
 *   4. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env.
 *
 * Usage:
 *   npm run token
 * then open the printed URL, approve, and copy the refresh token.
 */
import http from 'node:http';
import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

// Load .env (minimal parser so we don't need a dependency).
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env — rely on shell env */
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT = 'http://localhost:4567/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // force a refresh_token every time
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  if (!code) {
    res.writeHead(400);
    res.end('No code');
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Success! You can close this tab and return to the terminal.</h2>');

    // Create the wedding root folder NOW so it is owned by the app. With the
    // drive.file scope the app can only see files/folders it creates, so this
    // guarantees access. Prints the id for GOOGLE_DRIVE_FOLDER_ID.
    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    try {
      const drive = google.drive({ version: 'v3', auth: oauth2 });
      if (!folderId) {
        const created = await drive.files.create({
          requestBody: {
            name: 'Bricx & Hannah Wedding',
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = created.data.id || '';
      }
    } catch (err) {
      console.error('Could not auto-create the wedding folder:', err?.message || err);
    }

    console.log('\n──────────────────────────────────────────────');
    console.log('GOOGLE_REFRESH_TOKEN=' + (tokens.refresh_token || '(none returned)'));
    if (folderId) console.log('GOOGLE_DRIVE_FOLDER_ID=' + folderId);
    console.log('──────────────────────────────────────────────');
    console.log('Copy these into your .env and Vercel env vars.\n');
    if (!tokens.refresh_token) {
      console.log('No refresh token returned — remove this app from');
      console.log('https://myaccount.google.com/permissions and run again.');
    }
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500);
    res.end('Error exchanging code');
    console.error(e);
    process.exit(1);
  }
});

server.listen(4567, () => {
  console.log('\nUsing scope: drive.file (app can only see files it creates).');
  console.log('\n1) Open this URL in your browser and approve:\n');
  console.log(url + '\n');
  console.log('Waiting for the redirect on http://localhost:4567 ...');
});
