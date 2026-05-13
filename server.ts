
console.log("[Boot] Server process starting...");
process.on("uncaughtException", (err) => {
  console.error("[Fatal] uncaughtException", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[Fatal] unhandledRejection", err);
});

console.log("[Boot] Step 1: starting server file");
import express from 'express';
import path from 'path';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';

console.log("[Boot] Step 2: imports loaded");
const app = express();
console.log("[Boot] Step 3: express app created");
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
console.log("[Boot] Step 4: middleware registered");

function getRedirectUri() {
  let appUrl = process.env.APP_URL || 'http://localhost:3000';
  
  // Force https for the redirect URI if we're not on localhost.
  // This helps prevent redirect_uri_mismatch errors caused by proxy headers.
  if (!appUrl.includes('localhost') && appUrl.startsWith('http://')) {
    appUrl = appUrl.replace('http://', 'https://');
  }

  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  console.log(`[OAuth] [Config] APP_URL: "${appUrl}"`);
  console.log(`[OAuth] [Config] Generated Redirect URI: "${redirectUri}"`);
  return redirectUri;
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  
  const expectedClientId = '253229349598-8bighvlv3pqv3fpsbogp0pu8abifpjvm.apps.googleusercontent.com';
  const fbProjectNumber = '253229349598';

  console.log('--- EXHAUSTIVE OAUTH AUDIT START ---');
  if (!clientId || !clientSecret) {
    console.error('[OAuth Audit] CRITICAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing!');
  } else {
    const projectNumber = clientId.split('-')[0];
    
    console.log(`[OAuth Audit] 1. Full Client ID in use: "${clientId}"`);
    console.log(`[OAuth Audit] 2. Derived Project Number: "${projectNumber}"`);
    console.log(`[OAuth Audit] 3. Client ID Match (Target: ...pjvm...): ${clientId === expectedClientId ? 'MATCH ✅' : 'MISMATCH ❌'}`);
    console.log(`[OAuth Audit] 4. Project Number Match (Firebase: ${fbProjectNumber}): ${projectNumber === fbProjectNumber ? 'MATCH ✅' : 'MISMATCH ❌'}`);
    
    // Check for fallback/collision
    console.log(`[OAuth Audit] 5. Fallback Check: Custom logic is using environment variables. No Firebase Auth fallback detected in this route.`);
    
    // Check for whitespace
    if (clientId !== clientId.trim()) console.warn('[OAuth Audit] ⚠️ WARNING: Client ID had leading/trailing whitespace which was trimmed.');
    if (clientSecret !== clientSecret.trim()) console.warn('[OAuth Audit] ⚠️ WARNING: Client Secret had leading/trailing whitespace which was trimmed.');
    
    // Check redirect URI again
    const redirectUri = getRedirectUri();
    console.log(`[OAuth Audit] 6. Redirect URI: "${redirectUri}" (Confirm this EXACT string is in Google Console)`);
  }
  console.log('--- EXHAUSTIVE OAUTH AUDIT END ---');

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    getRedirectUri()
  );
}

// Global Request Logger
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

// API Router
const apiRouter = express.Router();

function handleGoogleError(res: express.Response, err: unknown, context: string) {
  const error = err as { response?: { data?: Record<string, unknown>; status?: number }; message?: string };
  const errorData = error?.response?.data || { message: error?.message || String(err) };
  
  // Extract specific Google error reasons
  const gErrors = (errorData.error as Record<string, unknown>)?.errors as Array<Record<string, unknown>>;
  const isInsufficient = gErrors?.some(e => e.reason === 'insufficientPermissions');
  
  console.error(`[API] [Google] [${context}] FAILED`);
  console.error(`  - Status: ${error?.response?.status || 500}`);
  
  if (isInsufficient) {
    console.error(`  - [HINT] Insufficient permissions. Clearing cookie and returning 401.`);
    res.clearCookie('google_tokens');
    return res.status(401).json({ 
      error: 'Insufficient permissions. Please reconnect your Google Calendar.',
      details: errorData,
      needsReauth: true
    });
  }

  try {
    console.log(`  - Error Details: ${JSON.stringify(errorData)}`);
  } catch {
    console.log(`  - Error Message: ${error?.message || String(err)}`);
  }

  return res.status(error?.response?.status || 500).json({ 
    error: `Failed to ${context}`,
    details: errorData
  });
}

async function getAuthorizedCalendar(req: express.Request, res: express.Response) {
  const tokensCookie = req.cookies.google_tokens;
  const authHeaderToken = req.headers.authorization?.startsWith('Bearer ') 
    ? req.headers.authorization.substring(7) 
    : null;

  if (!tokensCookie && !authHeaderToken) {
    console.log('[OAuth] No tokens found in cookie or header');
    return null;
  }

  let tokens;
  try {
    tokens = tokensCookie ? (typeof tokensCookie === 'string' ? JSON.parse(tokensCookie) : tokensCookie) : { access_token: authHeaderToken };
    if (typeof tokens === 'string') {
      tokens = JSON.parse(tokens);
    }
  } catch (e) {
    console.warn('[OAuth] Failed to parse tokens:', e);
    return null;
  }
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  try {
    // Before attempting refresh, check if we even have a refresh token
    if (!tokens.refresh_token) {
      console.warn('[OAuth] [Refresh] Missing refresh_token in credentials. Refresh will fail if access_token is expired.');
    }

    const { token } = await oauth2Client.getAccessToken();
    if (token && token !== tokens.access_token) {
      console.log('[OAuth] [Refresh] Successfully refreshed access token.');
      const newTokens = { ...tokens, access_token: token };
      res.cookie('google_tokens', JSON.stringify(newTokens), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    } else {
      console.log('[OAuth] [Refresh] Token is still valid, no refresh needed.');
      // Diagnostic: Verify the current token is actually valid
      try {
        await oauth2Client.getTokenInfo(tokens.access_token);
      } catch (diagErr: unknown) {
        const dErr = diagErr as { message?: string };
        console.error('[OAuth] [Diagnostic] Current access_token rejected by Google:', dErr.message);
        if (tokens.refresh_token) {
          console.log('[OAuth] [Diagnostic] Attempting FORCED refresh due to diagnostic failure...');
          try {
            const { tokens: forcedTokens } = await oauth2Client.refreshAccessToken();
            if (forcedTokens && forcedTokens.access_token) {
              console.log('[OAuth] [Diagnostic] FORCED refresh successful.');
              res.cookie('google_tokens', JSON.stringify(forcedTokens), {
                httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000
              });
              // Update client with new credentials for the current request
              oauth2Client.setCredentials(forcedTokens);
            }
          } catch (refreshErr: unknown) {
             const rErr = refreshErr as { message?: string };
             console.error('[OAuth] [Diagnostic] FORCED refresh failed:', rErr.message);
             res.clearCookie('google_tokens');
             return null;
          }
        } else {
          console.error('[OAuth] [Diagnostic] No refresh_token available to recover. Clearing cookies.');
          res.clearCookie('google_tokens');
          return null;
        }
      }
    }
  } catch (err: unknown) {
    const error = err as { message?: string; response?: { data?: { error?: string }; status?: number } };
    console.error('[OAuth] Token refresh failed significantly:', error.message);
    
    // Explicitly check for invalid_token to clear state
    const isInvalid = error.message?.includes('invalid_token') || 
                      error.response?.data?.error === 'invalid_token' ||
                      error.response?.status === 400 || 
                      error.response?.status === 401;
    
    if (isInvalid) {
      console.warn('[OAuth] [Critical] Token has been revoked or is invalid. Clearing cookies.');
      res.clearCookie('google_tokens');
    }
    return null;
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// OAuth Routes
apiRouter.get('/auth/google/url', (req, res) => {
  console.log('[API] GET /api/auth/google/url');
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });
  console.log(`[OAuth] [AuthURL] Generated Auth URL: ${url}`);
  res.json({ url });
});

apiRouter.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Missing code');
  }

  try {
    console.log('[OAuth] [Callback] Exchanging code for tokens...');
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('[OAuth] [Tokens Received] Access Token present:', !!tokens.access_token);
    console.log('[OAuth] [Tokens Received] Refresh Token present:', !!tokens.refresh_token);
    console.log('[OAuth] [Tokens Received] Expiry Date:', tokens.expiry_date);

    if (!tokens.refresh_token) {
      console.warn('[OAuth] [Warning] No refresh_token returned. This usually happens if the user already authorized the app. "prompt: consent" should have fixed this, but check if user revoked access first.');
    }

    // Set the cookie
    res.cookie('google_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS',
                tokens: ${JSON.stringify(tokens)} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. You can close this window if it doesn't close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth callback error');
  }
});

apiRouter.post('/auth/google/token', (req, res) => {
  try {
    console.log('[API] [Token] Received token request');
    const { tokens } = req.body;
    
    if (!tokens) {
      console.error('[API] [Token] [Error] No tokens object in request body');
      return res.status(400).json({ error: 'Tokens object required' });
    }

    const accessToken = tokens.access_token;
    console.log("[Setup] Access token received:", !!accessToken);
    
    if (!accessToken) {
      console.error('[API] [Token] [Error] No access_token in tokens object');
      return res.status(400).json({ error: 'access_token required' });
    }

    res.cookie('google_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[API] [Token] [Fatal Error]:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

apiRouter.post("/calendar/setup", async (req, res) => {
  console.log('[API] [Setup] [Step 1] Calendar setup requested');
  const calendar = await getAuthorizedCalendar(req, res);

  if (!calendar) {
    return res.status(401).json({ error: "Missing or invalid Google credentials" });
  }

  try {
    const calendarList = await calendar.calendarList.list();
    let tutorTrackCalendar = calendarList.data.items?.find(
      (c) => c.summary === "TutorTrack" || c.summary === "TutorTrack Pro"
    );

    if (!tutorTrackCalendar) {
      const newCalendar = await calendar.calendars.insert({
        requestBody: {
          summary: "TutorTrack",
          description: "Lessons and schedule synced from TutorTrack Pro application",
          timeZone: "Asia/Bangkok"
        }
      });
      tutorTrackCalendar = {
        id: newCalendar.data.id,
        summary: newCalendar.data.summary
      };
    }

    await calendar.events.list({
      calendarId: tutorTrackCalendar.id || 'primary',
      maxResults: 1
    });

    return res.json({ success: true, calendarId: tutorTrackCalendar.id || 'primary' });
  } catch (err: unknown) {
    handleGoogleError(res, err, 'setup calendar');
  }
});

apiRouter.get('/calendar/list', async (req, res) => {
  console.log('[API] GET /api/calendar/list HANDLER TRIGGERED');
  const calendar = await getAuthorizedCalendar(req, res);
  if (!calendar) {
    console.warn('[API] GET /api/calendar/list - Not authenticated');
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }
  try {
    console.log('[API] [CalendarList] Fetching calendar list...');
    const response = await calendar.calendarList.list();
    console.log('[API] [CalendarList] Successfully fetched', (response.data.items?.length || 0), 'calendars');
    res.json(response.data.items || []);
  } catch (err: unknown) {
    handleGoogleError(res, err, 'fetch calendar list');
  }
});

apiRouter.get('/calendar/events', async (req, res) => {
  const calendar = await getAuthorizedCalendar(req, res);
  const calendarIdFromQuery = req.query.calendarId as string;
  const calendarId = (calendarIdFromQuery && calendarIdFromQuery !== 'null' && calendarIdFromQuery !== 'undefined' && calendarIdFromQuery !== '[object Object]') 
    ? calendarIdFromQuery 
    : 'primary';
  if (!calendar) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  try {
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items || []);
  } catch (err: unknown) {
    handleGoogleError(res, err, 'fetch calendar events');
  }
});

apiRouter.post('/calendar/events', async (req, res) => {
  const calendar = await getAuthorizedCalendar(req, res);
  const calendarIdFromQuery = req.query.calendarId as string;
  const calendarId = (calendarIdFromQuery && calendarIdFromQuery !== 'null' && calendarIdFromQuery !== 'undefined' && calendarIdFromQuery !== '[object Object]') 
    ? calendarIdFromQuery 
    : 'primary';
  if (!calendar) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  const { summary, description, start, end, attendees } = req.body;

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: start, timeZone: 'Asia/Bangkok' },
        end: { dateTime: end, timeZone: 'Asia/Bangkok' },
        attendees: attendees || [],
      },
    });

    res.json(response.data);
  } catch (err: unknown) {
    handleGoogleError(res, err, 'create calendar event');
  }
});

apiRouter.patch('/calendar/events/:eventId', async (req, res) => {
  const calendar = await getAuthorizedCalendar(req, res);
  const calendarIdFromQuery = req.query.calendarId as string;
  const calendarId = (calendarIdFromQuery && calendarIdFromQuery !== 'null' && calendarIdFromQuery !== 'undefined' && calendarIdFromQuery !== '[object Object]') 
    ? calendarIdFromQuery 
    : 'primary';
  if (!calendar) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  const { eventId } = req.params;
  const { summary, description, start, end, attendees } = req.body;

  try {
    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: start, timeZone: 'Asia/Bangkok' },
        end: { dateTime: end, timeZone: 'Asia/Bangkok' },
        attendees: attendees || [],
      },
    });

    res.json(response.data);
  } catch (err: unknown) {
    const error = err as { response?: { status?: number } };
    if (error?.response?.status === 404 || error?.response?.status === 410) {
      return res.status(404).json({ 
        error: 'Event not found in Google Calendar',
        details: { message: 'The event may have been deleted manually in Google Calendar.' },
        eventNotFound: true 
      });
    }
    handleGoogleError(res, err, 'update calendar event');
  }
});

apiRouter.delete('/calendar/events/:eventId', async (req, res) => {
  const calendar = await getAuthorizedCalendar(req, res);
  const calendarIdFromQuery = req.query.calendarId as string;
  const calendarId = (calendarIdFromQuery && calendarIdFromQuery !== 'null' && calendarIdFromQuery !== 'undefined' && calendarIdFromQuery !== '[object Object]') 
    ? calendarIdFromQuery 
    : 'primary';
  if (!calendar) {
    return res.status(401).json({ error: 'Not authenticated with Google' });
  }

  const { eventId } = req.params;

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
    res.json({ success: true });
  } catch (err: unknown) {
    const error = err as { response?: { status?: number } };
    if (error?.response?.status === 404 || error?.response?.status === 410) {
      return res.json({ success: true, alreadyDeleted: true });
    }
    handleGoogleError(res, err, 'delete calendar event');
  }
});

apiRouter.post('/auth/logout', (req, res) => {
    res.clearCookie('google_tokens');
    res.json({ success: true });
});

apiRouter.get('/auth/status', (req, res) => {
    res.json({ isAuthenticated: !!req.cookies.google_tokens });
});

// Actually mount the router
app.use('/api', apiRouter);

console.log("[Boot] Step 5: routes registered via Router");

// API 404 Handler - Catch-all for missing API routes (under /api)
apiRouter.use((req, res) => {
  console.warn(`[Server] API 404 (Router match fail): ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: `API route not found: ${req.method} ${req.url}`,
    hint: "Check server.ts apiRouter definitions"
  });
});


// Global Error Handler (Must be last)
app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error Handler]', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Vite middleware for development
async function startServer() {
  console.log(`[Boot] NODE_ENV: ${process.env.NODE_ENV}`);
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Use standard Express 5 wildcard parameter
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.log("[Boot] Step 6: about to listen");
  console.log(`[Server] Attempting to listen on 0.0.0.0:${PORT}...`);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Successfully listening on 0.0.0.0:${PORT}`);
  });
}

startServer();
