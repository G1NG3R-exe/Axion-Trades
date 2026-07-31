import {
  authRateLimited,
  clearAuthFailures,
  createSession,
  credentialError,
  isTrustedWrite,
  noStoreJson,
  normalizeUsername,
  performDummyPasswordCheck,
  recordAuthFailure,
  verifyPassword,
} from "../../../account-auth";
import { getD1 } from "../../../../db";
import { proxySitesRequest, usesSitesProxy } from "../../sites-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (usesSitesProxy()) return proxySitesRequest(request);
  if (!isTrustedWrite(request)) return noStoreJson({ error: "Request origin was rejected." }, { status: 403 });

  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    const validationError = credentialError(username, body.password);
    if (validationError) return noStoreJson({ error: "Invalid username or password." }, { status: 401 });
    if (await authRateLimited(request, username)) {
      return noStoreJson({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const row = await getD1()
      .prepare(
        `SELECT id, username, password_hash, password_salt, password_iterations
         FROM accounts WHERE username = ? LIMIT 1`,
      )
      .bind(username)
      .first<{
        id: string;
        username: string;
        password_hash: string;
        password_salt: string;
        password_iterations: number;
      }>();

    const password = body.password as string;
    const valid = row
      ? await verifyPassword(password, row.password_hash, row.password_salt, row.password_iterations)
      : (await performDummyPasswordCheck(password), false);
    if (!row || !valid) {
      await recordAuthFailure(request, username);
      return noStoreJson({ error: "Invalid username or password." }, { status: 401 });
    }

    await clearAuthFailures(request, username);
    const user = { id: row.id, username: row.username };
    const session = await createSession(request, user);
    return noStoreJson({ user }, { headers: { "set-cookie": session.cookie } });
  } catch (error) {
    console.error("Signal Forge login failed", error);
    return noStoreJson({ error: "The account service is temporarily unavailable." }, { status: 503 });
  }
}
