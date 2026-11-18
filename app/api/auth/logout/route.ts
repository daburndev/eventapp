import { signOutStaff } from "@/lib/services/staff-auth";

export async function POST() {
  return signOutStaff();
}
