import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

const clamp = (value, max) => String(value ?? "").trim().slice(0, max)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body
  if (typeof req.body === "string" && req.body.length) {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  // Fallback: read the raw stream
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  try {
    const body = await readBody(req)

    // Honeypot — real users never fill this hidden field
    if (clamp(body.company, 100)) {
      return res.status(200).json({ ok: true })
    }

    const name = clamp(body.name, 120)
    const phone = clamp(body.phone, 40)
    const email = clamp(body.email, 200)
    const service = clamp(body.service, 120)
    const note = clamp(body.note, 1000)

    if (name.length < 2) {
      return res.status(400).json({ ok: false, error: "Please enter your name." })
    }
    if (!phone && !email) {
      return res.status(400).json({ ok: false, error: "Add a phone number or email so Zack can reach you." })
    }
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: "That email doesn't look right." })
    }
    if (phone && phone.replace(/\D/g, "").length < 7) {
      return res.status(400).json({ ok: false, error: "That phone number doesn't look right." })
    }

    await sql`
      INSERT INTO waitlist_signups (name, phone, email, service, note)
      VALUES (${name}, ${phone || null}, ${email || null}, ${service || null}, ${note || null})
    `

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.log("[v0] waitlist insert error:", error?.message)
    return res.status(500).json({ ok: false, error: "Something went wrong. Please call the shop instead." })
  }
}
