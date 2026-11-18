import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function POST(_request: Request, context: RouteContext<"/api/queue/[submissionId]/remove">) {
  const { submissionId } = await context.params;
  return proxyRpc("remove_submission", { submissionId }, "staff");
}
