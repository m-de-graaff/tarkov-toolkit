import type { IncomingMessage, ServerResponse } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../_lib/auth.js';

const notConfigured = (_req: IncomingMessage, res: ServerResponse) => {
  res.statusCode = 503;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: 'accounts are not configured on this deployment' }));
};

export default process.env.DATABASE_URL ? toNodeHandler(auth) : notConfigured;
