// Anonymous per-browser id, used for rate limiting and "unique guests" stats.
// Storage can be blocked (private mode), so fall back to an in-memory id for the session.

const DEVICE_ID_KEY = "camskynet.deviceId";

let memoryDeviceId: string | null = null;

export function getDeviceId(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }
    const created = createUuid();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    memoryDeviceId ??= createUuid();
    return memoryDeviceId;
  }
}

// crypto.randomUUID only exists in secure contexts (HTTPS/localhost), so plain-HTTP LAN
// testing on a phone needs a v4 UUID built from getRandomValues, which works everywhere.
function createUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
