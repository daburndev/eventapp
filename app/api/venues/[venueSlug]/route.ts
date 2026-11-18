import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function GET(_request: Request, context: RouteContext<"/api/venues/[venueSlug]">) {
  const { venueSlug } = await context.params;
  return proxyRpc("get_venue_public", { venueSlug }, "anon");
}
