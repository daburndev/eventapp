import type { PublicVenue } from "@/interfaces/venue/venue";
import { mapPublicVenue } from "@/features/guest-submission/mappers/venue.mapper";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { apiRequest } from "@/lib/services/request";

export async function fetchPublicVenue(venueSlug: string): Promise<PublicVenue> {
  return mapPublicVenue(await apiRequest(API_ROUTES.venue(venueSlug)));
}
