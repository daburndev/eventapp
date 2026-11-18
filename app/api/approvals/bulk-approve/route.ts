import { readJsonBody } from "@/lib/services/api-response";
import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function POST(request: Request) {
  return proxyRpc("approve_submissions", await readJsonBody(request), "staff");
}
