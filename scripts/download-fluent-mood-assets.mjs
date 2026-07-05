#!/usr/bin/env node
/** 从 microsoft/fluentui-emoji 拉取心情 Fluent Emoji 3D PNG（MIT） */
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../packages/ui/src/assets/mood')

const MAP = {
  'happy.png': 'Slightly smiling face/slightly_smiling_face_3d.png',
  'content.png': 'Smiling face with smiling eyes/smiling_face_with_smiling_eyes_3d.png',
  'peaceful.png': 'Relieved face/relieved_face_3d.png',
  'excited.png': 'Grinning face with smiling eyes/grinning_face_with_smiling_eyes_3d.png',
  'grateful.png': 'Yellow heart/yellow_heart_3d.png',
  'reflective.png': 'Neutral face/neutral_face_3d.png',
  'melancholy.png': 'Pensive face/pensive_face_3d.png',
  'anxious.png': 'Anxious face with sweat/anxious_face_with_sweat_3d.png',
  'glorious.png': 'Sparkles/sparkles_3d.png'
}

mkdirSync(OUT_DIR, { recursive: true })

for (const [outName, rel] of Object.entries(MAP)) {
  const [folder, file] = rel.split('/')
  const url = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodeURIComponent(folder)}/3D/${file}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(join(OUT_DIR, outName), buf)
  console.log('saved', outName)
}

copyFileSync(join(__dirname, '../packages/ui/src/assets/weather/LICENSE'), join(OUT_DIR, 'LICENSE'))
console.log('Done ->', OUT_DIR)
