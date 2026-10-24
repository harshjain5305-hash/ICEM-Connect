import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse
) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(
    JSON.stringify({
      status: 'ok',
      service: 'ICEM Connect Vercel Edge/Serverless Gateway',
      environment: process.env.NODE_ENV || 'production',
      version: '1.1.0',
      domain: process.env.VITE_INSTITUTION_EMAIL_DOMAIN || 'indiraicem.ac.in',
      timestamp: new Date().toISOString(),
    })
  );
}
