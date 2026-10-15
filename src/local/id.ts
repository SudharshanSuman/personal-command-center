// Collision-resistant id generator for the local-first (Capacitor/on-device
// SQLite) build. Prisma's server build used cuid() via @default(cuid()); on
// device there is no Prisma, so ids are generated in the client data layer.
// Format: "c" + timestamp(base36) + 16 random base36 chars — monotonic-ish
// prefix keeps inserts roughly ordered, random suffix avoids collisions.
export function createId(): string {
  const ts = Date.now().toString(36)
  let rand = ""
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
  const cryptoObj =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined
  if (cryptoObj && cryptoObj.getRandomValues) {
    const buf = new Uint32Array(4)
    cryptoObj.getRandomValues(buf)
    buf.forEach((n) => {
      rand += n.toString(36)
    })
  } else {
    for (let i = 0; i < 16; i++) rand += alphabet[Math.floor(Math.random() * 36)]
  }
  return "c" + ts + rand.slice(0, 20)
}
