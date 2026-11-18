import type { Tier } from "@/interfaces/venue/venue";

interface TierPickerProps {
  tiers: Tier[];
  selectedTierId: string;
  onSelect: (tierId: string) => void;
  error?: string;
}

export function TierPicker({ tiers, selectedTierId, onSelect, error }: TierPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">How long on screen?</legend>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((tier) => {
          const isSelected = tier.id === selectedTierId;
          return (
            <button
              key={tier.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(tier.id)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-xl border px-2 text-center transition-colors ${
                isSelected
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line bg-surface text-text hover:border-accent"
              }`}
            >
              <span className="text-lg font-bold">{tier.durationSeconds}s</span>
              <span className={`text-xs ${isSelected ? "text-on-accent" : "text-muted"}`}>
                {tier.priceSatang === null ? "Free" : `${tier.priceSatang / 100} ฿`}
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}
