import { getAccountSession, noStoreJson } from "../../../account-auth";
import { proxySitesRequest, usesSitesProxy } from "../../sites-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (usesSitesProxy()) return proxySitesRequest(request);
  try {
    const session = await getAccountSession(request);
    return noStoreJson({ user: session?.user ?? null });
  } catch (error) {
    console.error("Signal Forge session lookup failed", error);
    return noStoreJson({ error: "The account service is temporarily unavailable." }, { status: 503 });
  }
}
