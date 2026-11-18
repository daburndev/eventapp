import { StaffGate } from "@/features/staff-auth/pages/StaffGate";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <StaffGate>{children}</StaffGate>;
}
