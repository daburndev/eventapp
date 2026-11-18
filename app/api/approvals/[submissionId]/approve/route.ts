import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function POST(_request: Request, context: RouteContext<"/api/approvals/[submissionId]/approve">) {
  const { submissionId } = await context.params;
  return proxyRpc("approve_submission", { submissionId }, "staff");
}
