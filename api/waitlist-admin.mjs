import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

// Constant-time-ish comparison to avoid leaking length/timing
function safeEqual(a, b) {
  a = String(a ?? "")
  b = String(b ?? "")
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  const secret = process.env.WAITLIST_ADMIN_KEY
  if (!secret) {
    return res.status(500).json({ ok: false, error: "Dashboard is not configured yet." })
  }

  // Accept the key from a header or the query string (?key=...)
  const provided =
    req.headers["x-admin-key"] ||
    (req.query && req.query.key) ||
    ""

  if (!safeEqual(provided, secret)) {
    return res.status(401).json({ ok: false, error: "Wrong password." })
  }

  try {
    const rows = await sql`
      SELECT id, name, phone, email, service, note, created_at
      FROM waitlist_signups
      ORDER BY created_at DESC
    `
    return res.status(200).json({ ok: true, count: rows.length, signups: rows })
  } catch (error) {
    console.log("[v0] waitlist-admin query error:", error?.message)
    return res.status(500).json({ ok: false, error: "Could not load signups." })
  }
}
