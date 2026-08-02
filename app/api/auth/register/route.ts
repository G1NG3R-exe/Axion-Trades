import {
  authRateLimited,
  clearAuthFailures,
  createPasswordRecord,
  createSession,
  credentialError,
  isTrustedWrite,
  noStoreJson,
  normalizeUsername,
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
    if (validationError) return noStoreJson({ error: validationError }, { status: 400 });
    if (await authRateLimited(request, username)) {
      return noStoreJson({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const d1 = getD1();
    const existing = await d1
      .prepare("SELECT id FROM accounts WHERE username = ? LIMIT 1")
      .bind(username)
      .first<{ id: string }>();
    if (existing) return noStoreJson({ error: "That username is already taken." }, { status: 409 });

    const password = body.password as string;
    const passwordRecord = await createPasswordRecord(password);
    const user = { id: crypto.randomUUID(), username };
    await d1
      .prepare(
        `INSERT INTO accounts
          (id, username, password_hash, password_salt, password_iterations)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(user.id, user.username, passwordRecord.hash, passwordRecord.salt, passwordRecord.iterations)
      .run();
    await clearAuthFailures(request, username);
    const session = await createSession(request, user);
    return noStoreJson(
      { user },
      { status: 201, headers: { "set-cookie": session.cookie } },
    );
  } catch (error) {
    console.error("axion-trades registration failed", error);
    return noStoreJson({ error: "The account service is temporarily unavailable." }, { status: 503 });
  }
}
