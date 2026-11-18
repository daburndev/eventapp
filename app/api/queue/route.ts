import { readQueryPayload } from "@/lib/services/api-response";
import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function GET(request: Request) {
  return proxyRpc("get_queue", readQueryPayload(request), "staff");
}
