import { proxyRpc } from "@/lib/services/rpc-proxy";

export async function GET() {
  return proxyRpc("list_my_venues", {}, "staff");
}
