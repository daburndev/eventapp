import type { PublicVenue, ServiceType, Tier } from "@/interfaces/venue/venue";
import { asRecord, readArray, readBoolean, readEnum, readNullableNumber, readNumber, readString } from "@/lib/utils/read-field";

const SERVICE_TYPES: readonly ServiceType[] = ["event", "venue"];

function mapTier(payload: unknown): Tier {
  const record = asRecord(payload);
  return {
    id: readString(record, "id"),
    label: readString(record, "label"),
    durationSeconds: readNumber(record, "durationSeconds", 15),
    priceSatang: readNullableNumber(record, "priceSatang"),
  };
}

export function mapPublicVenue(payload: unknown): PublicVenue {
  const record = asRecord(payload);
  return {
    id: readString(record, "id"),
    slug: readString(record, "slug"),
    name: readString(record, "name"),
    serviceType: readEnum(record, "serviceType", SERVICE_TYPES, "event"),
    isAccepting: readBoolean(record, "isAccepting", false),
    isQueueFull: readBoolean(record, "isQueueFull", false),
    queueMinutes: readNumber(record, "queueMinutes"),
    tiers: readArray(record, "tiers").map(mapTier),
  };
}
