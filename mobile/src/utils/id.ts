/**
 * Client-local id generator for optimistic-send `tempId`s (CONTRACT.md
 * §3.6/§4.2). Not used for anything security-sensitive — just needs to be
 * unique enough to dedupe a single sender's own in-flight sends, so a
 * `Math.random`-based UUID v4 is fine here (avoids depending on
 * `crypto.randomUUID()`, whose availability varies across RN/Hermes
 * versions, or pulling in `expo-crypto` for one call site).
 */
export function generateTempId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
