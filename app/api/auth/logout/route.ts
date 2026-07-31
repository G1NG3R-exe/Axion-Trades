import {
  deleteSession,
  expiredSessionCookie,
  getAccountSession,
  isTrustedWrite,
  noStoreJson,
} from "../../../account-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedWrite(request)) return noStoreJson({ error: "Request origin was rejected." }, { status: 403 });
  try {
    const session = await getAccountSession(request);
    if (session) await deleteSession(session.tokenHash);
  } catch {
    // Clearing the browser cookie still signs this device out if storage is unavailable.
  }
  return noStoreJson(
    { signedOut: true },
    { headers: { "set-cookie": expiredSessionCookie(request), "clear-site-data": '"cache"' } },
  );
}
