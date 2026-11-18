import { readJsonBody } from "@/lib/services/api-response";
import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function POST(request: Request, context: RouteContext<"/api/approvals/[submissionId]/reject">) {
  const { submissionId } = await context.params;
  return proxyRpc("reject_submission", { ...(await readJsonBody(request)), submissionId }, "staff");
}
