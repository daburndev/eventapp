// Defensive accessors for external payloads (CODING_STYLE §6 "Map defensively").
// Each accepts one key or several spellings, coerces the type, and falls back safely.

export type UnknownRecord = Record<string, unknown>;

type KeyOrKeys = string | readonly string[];

export function asRecord(value: unknown): UnknownRecord {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
}

function pickValue(record: UnknownRecord, keys: KeyOrKeys): unknown {
  const candidates = typeof keys === "string" ? [keys] : keys;
  for (const key of candidates) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function readNullableString(record: UnknownRecord, keys: KeyOrKeys): string | null {
  const value = pickValue(record, keys);
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function readString(record: UnknownRecord, keys: KeyOrKeys, fallback = ""): string {
  return readNullableString(record, keys) ?? fallback;
}

export function readNullableNumber(record: UnknownRecord, keys: KeyOrKeys): number | null {
  const value = pickValue(record, keys);
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : null;
}

export function readNumber(record: UnknownRecord, keys: KeyOrKeys, fallback = 0): number {
  return readNullableNumber(record, keys) ?? fallback;
}

export function readBoolean(record: UnknownRecord, keys: KeyOrKeys, fallback = false): boolean {
  const value = pickValue(record, keys);
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true" || value === "false") {
    return value === "true";
  }
  return fallback;
}

export function readArray(record: UnknownRecord, keys: KeyOrKeys): unknown[] {
  const value = pickValue(record, keys);
  return Array.isArray(value) ? value : [];
}

export function readRecord(record: UnknownRecord, keys: KeyOrKeys): UnknownRecord | null {
  const value = pickValue(record, keys);
  return value === undefined ? null : asRecord(value);
}

export function readEnum<TValue extends string>(
  record: UnknownRecord,
  keys: KeyOrKeys,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  const value = readNullableString(record, keys);
  return allowed.find((option) => option === value) ?? fallback;
}
