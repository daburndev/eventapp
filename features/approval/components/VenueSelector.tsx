import type { StaffVenue } from "@/interfaces/venue/venue";

interface VenueSelectorProps {
  venues: StaffVenue[];
  selectedVenueId: string;
  onSelect: (venueId: string) => void;
}

export function VenueSelector({ venues, selectedVenueId, onSelect }: VenueSelectorProps) {
  if (venues.length === 1) {
    return <h1 className="text-2xl font-bold">{venues[0].name}</h1>;
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">Venue</span>
      <select
        value={selectedVenueId}
        onChange={(event) => onSelect(event.target.value)}
        className="rounded-xl border border-line bg-surface-raised px-3 py-2 text-lg font-bold"
      >
        {venues.map((venue) => (
          <option key={venue.id} value={venue.id}>
            {venue.name}
          </option>
        ))}
      </select>
    </label>
  );
}
