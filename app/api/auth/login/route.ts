import { readJsonBody } from "@/lib/services/api-response";
import { signInStaff } from "@/lib/services/staff-auth";
import { readString } from "@/lib/utils/read-field";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return signInStaff(readString(body, "email"), readString(body, "password"));
}
