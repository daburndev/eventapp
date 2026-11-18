import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function POST(_request: Request, context: RouteContext<"/api/screens/[screenToken]/sync">) {
  const { screenToken } = await context.params;
  return proxyRpc("screen_sync", { screenToken }, "anon");
}
