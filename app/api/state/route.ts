import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { tradingStates } from "../../../db/schema";

export const dynamic = "force-dynamic";

const MAX_STATE_BYTES = 300_000;

async function resolveUserEmail(request: Request) {
  const user = await getChatGPTUser();
  if (user?.email) return user.email.toLowerCase();

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "local-preview@signalforge.dev";
  }

  return null;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes("trading_states")) {
    return "Persistent storage is still initializing. Try again in a moment.";
  }
  return "The lab could not reach persistent storage.";
}

export async function GET(request: Request) {
  const userEmail = await resolveUserEmail(request);
  if (!userEmail) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(tradingStates)
      .where(eq(tradingStates.userEmail, userEmail))
      .limit(1);

    if (!row) {
      return Response.json({ state: null, revision: 0 });
    }

    return Response.json({
      state: JSON.parse(row.payload),
      revision: row.revision,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userEmail = await resolveUserEmail(request);
  if (!userEmail) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { state?: unknown };
    if (!body.state || typeof body.state !== "object") {
      return Response.json({ error: "A valid state object is required." }, { status: 400 });
    }

    const payload = JSON.stringify(body.state);
    if (new TextEncoder().encode(payload).byteLength > MAX_STATE_BYTES) {
      return Response.json({ error: "Saved state is too large." }, { status: 413 });
    }

    const db = getDb();
    await db
      .insert(tradingStates)
      .values({ userEmail, payload })
      .onConflictDoUpdate({
        target: tradingStates.userEmail,
        set: {
          payload,
          revision: sql`${tradingStates.revision} + 1`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    const [saved] = await db
      .select({ revision: tradingStates.revision, updatedAt: tradingStates.updatedAt })
      .from(tradingStates)
      .where(eq(tradingStates.userEmail, userEmail))
      .limit(1);

    return Response.json({ saved: true, ...saved });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userEmail = await resolveUserEmail(request);
  if (!userEmail) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const db = getDb();
    await db.delete(tradingStates).where(eq(tradingStates.userEmail, userEmail));
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
