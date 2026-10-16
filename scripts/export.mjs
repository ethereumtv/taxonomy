#!/usr/bin/env node
// Regenerates data/taxonomy.json, data/taxonomy.csv, and taxonomy.md from the
// live Ethereum TV database, so this repo can never drift from what the site
// actually serves. A maintainer tool: it needs read credentials via env.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/export.mjs
//
// data/aliases.json is hand-maintained and deliberately not touched here.
//
// Licensed MIT (see scripts/LICENSE); the exported data is CC BY 4.0.
import { readFileSync, writeFileSync } from 'node:fs'

const URL_BASE = process.env.SUPABASE_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!URL_BASE || !ANON_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY to run the export (maintainer tool).')
  process.exit(1)
}

const res = await fetch(
  `${URL_BASE}/rest/v1/topics?select=id,slug,name,description,sort_order,color,parent_id,secondary_parent_id,updated_at&limit=1000`,
  { headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` } },
)
if (!res.ok) throw new Error(`topics fetch failed: ${res.status} ${await res.text()}`)
const rows = await res.json()

const byId = new Map(rows.map((r) => [r.id, r]))
const slugOf = (id) => (id ? (byId.get(id)?.slug ?? null) : null)

const SITE = 'https://ethereumtv.co'
const urlOf = (slug, parentSlug) =>
  parentSlug ? `${SITE}/topics/${parentSlug}/${slug}` : `${SITE}/topics/${slug}`

const nodes = rows
  .map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    parent: slugOf(r.parent_id),
    surfaces_in: slugOf(r.secondary_parent_id),
    url: urlOf(r.slug, slugOf(r.parent_id)),
    description: r.description,
    sort_order: r.sort_order,
    color: r.color,
  }))
  .sort((a, b) => {
    const pa = a.parent ?? ''
    const pb = b.parent ?? ''
    if (pa !== pb) {
      const ta = byId.get(rows.find((r) => r.slug === (a.parent ?? a.slug)).id)
      const tb = byId.get(rows.find((r) => r.slug === (b.parent ?? b.slug)).id)
      return ta.sort_order - tb.sort_order || a.slug.localeCompare(b.slug)
    }
    return (a.parent === null ? -1 : 1) - (b.parent === null ? -1 : 1) || a.sort_order - b.sort_order
  })

const topics = nodes.filter((n) => n.parent === null).sort((a, b) => a.sort_order - b.sort_order)
const childrenOf = (slug) =>
  nodes.filter((n) => n.parent === slug).sort((a, b) => a.sort_order - b.sort_order)
const surfacedIn = (slug) =>
  nodes
    .filter((n) => n.surfaces_in === slug)
    .sort((a, b) => a.sort_order - b.sort_order)

// Sanity: the v14 contract.
const shared = nodes.filter((n) => n.surfaces_in !== null)
if (topics.length !== 20 || nodes.length - topics.length !== 111 || shared.length !== 16) {
  throw new Error(
    `unexpected shape: ${topics.length} topics, ${nodes.length - topics.length} subtopics, ${shared.length} shared`,
  )
}

// --- data/taxonomy.json -----------------------------------------------------
const ordered = topics.flatMap((t) => [t, ...childrenOf(t.slug)])
const json = {
  version: 'v14',
  // Max updated_at across the table, not the run time, so re-running the
  // export on unchanged data produces a byte-identical file (the nightly
  // sync workflow relies on that to only open a PR on real drift).
  data_updated_at: rows.map((r) => r.updated_at).sort().at(-1),
  license: 'CC-BY-4.0',
  source: 'https://github.com/ethereumtv/taxonomy',
  counts: { topics: 20, subtopics: 109, shared_subtopics: 14 },
  notes:
    'One node per topic or subtopic. parent is null for the 20 top-level topics. A shared subtopic appears once, under its home parent (which owns the canonical URL), and surfaces_in names the one other topic it also appears under. url is the canonical page on ethereumtv.co; when you use this taxonomy elsewhere, linking these urls is the attribution we ask for.',
  nodes: ordered,
}
writeFileSync(new URL('../data/taxonomy.json', import.meta.url), JSON.stringify(json, null, 2) + '\n')

// --- data/taxonomy.csv ------------------------------------------------------
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
const csv = [
  'slug,name,parent,surfaces_in,url,sort_order,color,description',
  ...ordered.map((n) =>
    [n.slug, n.name, n.parent, n.surfaces_in, n.url, n.sort_order, n.color, n.description]
      .map(esc)
      .join(','),
  ),
].join('\n')
writeFileSync(new URL('../data/taxonomy.csv', import.meta.url), csv + '\n')

// --- the map, shared by taxonomy.md and the README splice -------------------
const nameOf = (slug) => byId.get(rows.find((r) => r.slug === slug).id).name
const body = []
for (const t of topics) {
  body.push(`### ${t.sort_order}. [${t.name}](${t.url}) \`/topics/${t.slug}\``)
  body.push('')
  body.push(`*${t.description}*`)
  body.push('')
  for (const s of childrenOf(t.slug)) {
    const share = s.surfaces_in ? ` \u21c4 ${nameOf(s.surfaces_in)}` : ''
    body.push(`- **[${s.name}](${s.url})**${share} \`/topics/${t.slug}/${s.slug}\`: ${s.description}`)
  }
  for (const s of surfacedIn(t.slug)) {
    body.push(
      `- **[${s.name}](${s.url})** \u21c4 *(home: ${nameOf(s.parent)})* \`/topics/${s.parent}/${s.slug}\`: ${s.description}`,
    )
  }
  body.push('')
}
const legend =
  `${topics.length} topics, ${nodes.length - topics.length} subtopics, ${shared.length} of them shared between two topics. Generated from the live database by \`scripts/export.mjs\`; edit the database, not this file. A \u21c4 marks a shared subtopic: it lives under its home topic (which owns the canonical URL) and also appears under the topic named after the arrow.`

// --- taxonomy.md ------------------------------------------------------------
writeFileSync(
  new URL('../taxonomy.md', import.meta.url),
  ['# The Ethereum TV taxonomy', '', legend, '', ...body].join('\n'),
)

// --- README splice: the full map lives on the repo front page too ------------
const readmeUrl = new URL('../README.md', import.meta.url)
const readme = readFileSync(readmeUrl, 'utf8')
const START = '<!-- taxonomy:start -->'
const END = '<!-- taxonomy:end -->'
const a = readme.indexOf(START)
const b = readme.indexOf(END)
if (a === -1 || b === -1 || b < a) throw new Error('README taxonomy markers missing or malformed')
writeFileSync(
  readmeUrl,
  readme.slice(0, a + START.length) +
    '\n\n' +
    body.join('\n').trimEnd() +
    '\n\n' +
    readme.slice(b),
)

console.log(
  `exported ${topics.length} topics, ${nodes.length - topics.length} subtopics (${shared.length} shared) to data/, taxonomy.md, and the README map section`,
)
