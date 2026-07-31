import { getAccountSession, isTrustedWrite, noStoreJson } from "../../account-auth";
import { getD1 } from "../../../db";
import { proxySitesRequest, usesSitesProxy } from "../sites-proxy";

export const dynamic = "force-dynamic";

const MAX_STATE_BYTES = 300_000;

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes("account_states")) {
    return "Account storage is still initializing. Try again in a moment.";
  }
  return "The lab could not reach account storage.";
}

export async function GET(request: Request) {
  if (usesSitesProxy()) return proxySitesRequest(request);
  try {
    const session = await getAccountSession(request);
    if (!session) return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    const row = await getD1()
      .prepare("SELECT payload, revision, updated_at FROM account_states WHERE account_id = ? LIMIT 1")
      .bind(session.user.id)
      .first<{ payload: string; revision: number; updated_at: string }>();
    if (!row) return noStoreJson({ state: null, revision: 0 });
    return noStoreJson({
      state: JSON.parse(row.payload),
      revision: row.revision,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return noStoreJson({ error: routeError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (usesSitesProxy()) return proxySitesRequest(request);
  if (!isTrustedWrite(request)) return noStoreJson({ error: "Request origin was rejected." }, { status: 403 });
  try {
    const session = await getAccountSession(request);
    if (!session) return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    const body = (await request.json()) as { state?: unknown };
    if (!body.state || typeof body.state !== "object") {
      return noStoreJson({ error: "A valid state object is required." }, { status: 400 });
    }
    const payload = JSON.stringify(body.state);
    if (new TextEncoder().encode(payload).byteLength > MAX_STATE_BYTES) {
      return noStoreJson({ error: "Saved state is too large." }, { status: 413 });
    }
    const d1 = getD1();
    await d1
      .prepare(
        `INSERT INTO account_states (account_id, payload)
         VALUES (?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           payload = excluded.payload,
           revision = account_states.revision + 1,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(session.user.id, payload)
      .run();
    const saved = await d1
      .prepare("SELECT revision, updated_at FROM account_states WHERE account_id = ? LIMIT 1")
      .bind(session.user.id)
      .first<{ revision: number; updated_at: string }>();
    return noStoreJson({ saved: true, revision: saved?.revision ?? 1, updatedAt: saved?.updated_at });
  } catch (error) {
    return noStoreJson({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (usesSitesProxy()) return proxySitesRequest(request);
  if (!isTrustedWrite(request)) return noStoreJson({ error: "Request origin was rejected." }, { status: 403 });
  try {
    const session = await getAccountSession(request);
    if (!session) return noStoreJson({ error: "Sign in is required." }, { status: 401 });
    await getD1().prepare("DELETE FROM account_states WHERE account_id = ?").bind(session.user.id).run();
    return noStoreJson({ deleted: true });
  } catch (error) {
    return noStoreJson({ error: routeError(error) }, { status: 500 });
  }
}
