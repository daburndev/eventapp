import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function GET(_request: Request, context: RouteContext<"/api/submissions/[publicToken]">) {
  const { publicToken } = await context.params;
  return proxyRpc("get_submission_status", { publicToken }, "anon");
}
