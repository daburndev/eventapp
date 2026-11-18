import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function POST(_request: Request, context: RouteContext<"/api/events/[venueId]/end">) {
  const { venueId } = await context.params;
  return proxyRpc("end_event", { venueId }, "staff");
}
