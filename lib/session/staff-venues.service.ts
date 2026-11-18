import type { ServiceType, StaffRole, StaffVenue } from "@/interfaces/venue/venue";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { apiRequest } from "@/lib/services/request";
import { asRecord, readEnum, readString } from "@/lib/utils/read-field";

// Shared staff-session kit: the staff venue list doubles as the "am I logged in?" check,
// and both the staff gate and admin pages need it.

const SERVICE_TYPES: readonly ServiceType[] = ["event", "venue"];
const STAFF_ROLES: readonly StaffRole[] = ["owner", "approver"];

function mapStaffVenue(payload: unknown): StaffVenue {
  const record = asRecord(payload);
  return {
    id: readString(record, "id"),
    slug: readString(record, "slug"),
    name: readString(record, "name"),
    serviceType: readEnum(record, "serviceType", SERVICE_TYPES, "event"),
    role: readEnum(record, "role", STAFF_ROLES, "approver"),
  };
}

export async function fetchStaffVenues(): Promise<StaffVenue[]> {
  const data = await apiRequest(API_ROUTES.staffVenues);
  return Array.isArray(data) ? data.map(mapStaffVenue) : [];
}
