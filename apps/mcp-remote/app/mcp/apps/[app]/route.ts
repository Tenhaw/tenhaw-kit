import { VERSION } from '@tenhaw/core';
import { createMcpHandler } from 'mcp-handler';
import { getAppProfile, registerAppTools } from '@tenhaw/mcp/apps';
import { secureRequest } from '../../../../src/security';

export const runtime = 'nodejs';
export const maxDuration = 10;
const handlers = new Map<string, (request: Request) => Promise<Response>>();

async function route(request: Request, context: { params: Promise<{ app: string }> }) {
  const { app } = await context.params;
  let profile;
  try { profile = getAppProfile(app); }
  catch { return Response.json({ error: 'Application not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }); }
  let handler = handlers.get(app);
  if (!handler) {
    handler = createMcpHandler(server => registerAppTools(server, app), {
      serverInfo: { name: profile.displayName, version: VERSION },
      instructions: `${profile.description} Use explicit evidence and this application's scoped tools. Customer credentials and raw repository events are not accepted.`,
      verboseLogs: false,
    });
    handlers.set(app, handler);
  }
  return secureRequest(request, handler);
}

export { route as POST, route as GET, route as OPTIONS };
