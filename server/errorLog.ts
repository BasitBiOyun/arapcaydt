import { serviceDatabase } from './auth.js';

/** The signed-in user's id from the request's token, for the log only (the token is checked by the handler). */
function ownerOf(req: any): string | null {
  const header = req?.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const sub = JSON.parse(Buffer.from(header.slice(7).split('.')[1] || '', 'base64url').toString('utf8'))?.sub;
    return typeof sub === 'string' && /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

async function record(route: string, status: number, message: string, req: any) {
  try {
    const row = { route: route.slice(0, 80), status, message: message.slice(0, 500), owner_id: ownerOf(req) };
    let { error } = await serviceDatabase().from('server_errors').insert(row);
    // A token of a profile that no longer exists: kept without the owner.
    if (error && row.owner_id) ({ error } = await serviceDatabase().from('server_errors').insert({ ...row, owner_id: null }));
  } catch {
    // Logging never changes the answer (no table yet, no service key in local development).
  }
}

/**
 * Keeps every 5xx answer and every crash of an API handler in `server_errors`, so failures
 * nobody reported still reach the admin panel and the morning check. The answer is unchanged.
 */
export function logged(route: string, handler: (req: any, res: any) => unknown, save: typeof record = record) {
  return async (req: any, res: any) => {
    const pending: Promise<void>[] = [];
    const status = res.status.bind(res);
    res.status = (code: number) => {
      const out = status(code);
      if (code >= 500 && out && typeof out.json === 'function') {
        const json = out.json.bind(out);
        out.json = (body: any) => {
          pending.push(save(route, code, String(body?.error || body?.message || '') + (body?.code ? ` [${body.code}]` : '') + (body?.detail ? ` · ${String(body.detail)}` : ''), req));
          return json(body);
        };
      }
      return out;
    };
    try {
      return await handler(req, res);
    } catch (error) {
      await save(route, 500, `Çöktü: ${error instanceof Error ? error.message : String(error)}`, req);
      throw error;
    } finally {
      await Promise.all(pending);
    }
  };
}
