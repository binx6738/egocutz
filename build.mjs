import { cp, rm, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"

const OUT = "dist"

// Fresh output directory
if (existsSync(OUT)) {
  await rm(OUT, { recursive: true, force: true })
}
await mkdir(OUT, { recursive: true })

// Copy static assets into the output directory
await cp("index.html", `${OUT}/index.html`)

for (const dir of ["css", "js", "assets"]) {
  if (existsSync(dir)) {
    await cp(dir, `${OUT}/${dir}`, { recursive: true })
  }
}

console.log(`[build] Static site assembled into ./${OUT}`)
