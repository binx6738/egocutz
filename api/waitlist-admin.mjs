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
  if (req.method !== "GET" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, DELETE")
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

  // Remove a completed signup
  if (req.method === "DELETE") {
    const id = (req.query && req.query.id) || ""
    if (!/^[0-9a-fA-F-]{36}$/.test(String(id))) {
      return res.status(400).json({ ok: false, error: "Invalid or missing id." })
    }
    try {
      const deleted = await sql`
        DELETE FROM waitlist_signups
        WHERE id = ${id}
        RETURNING id
      `
      if (!deleted.length) {
        return res.status(404).json({ ok: false, error: "Signup not found." })
      }
      return res.status(200).json({ ok: true, deletedId: deleted[0].id })
    } catch (error) {
      console.log("[v0] waitlist-admin delete error:", error?.message)
      return res.status(500).json({ ok: false, error: "Could not remove signup." })
    }
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
