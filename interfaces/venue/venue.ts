export type ServiceType = "event" | "venue";

export type StaffRole = "owner" | "approver";

export interface Tier {
  id: string;
  label: string;
  durationSeconds: number;
  priceSatang: number | null;
}

export interface PublicVenue {
  id: string;
  slug: string;
  name: string;
  serviceType: ServiceType;
  isAccepting: boolean;
  isQueueFull: boolean;
  queueMinutes: number;
  tiers: Tier[];
}

export interface StaffVenue {
  id: string;
  slug: string;
  name: string;
  serviceType: ServiceType;
  role: StaffRole;
}

export interface VenueSummary {
  id: string;
  slug: string;
  name: string;
}
