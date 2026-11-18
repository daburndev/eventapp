import { readJsonBody } from "@/lib/services/api-response";
import { proxyRpc } from "@/lib/services/rpc-proxy";
import { rejectIfNotHuman } from "@/lib/services/turnstile";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const rejection = await rejectIfNotHuman(body, request);
  if (rejection) {
    return rejection;
  }
  return proxyRpc("create_submission", body, "anon");
}
