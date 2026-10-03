// HTTP demo origins may not expose randomUUID. These IDs are not security tokens.
export function createId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
