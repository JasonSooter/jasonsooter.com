/**
 * Build-time smoke test for the markdown rendering pipeline.
 *
 * Reads the compiled output of data/blog/rendering-reference.mdx and asserts
 * that (a) each markdown feature actually produced markup, and (b) every
 * plugin-emitted class it relies on has a matching rule in the shipped CSS.
 *
 * (b) is the interesting half. A dependency bump can leave the build green
 * while silently decoupling markup from styles — katex 0.18 did exactly this:
 * npm kept a nested katex 0.16 for rehype-katex to render with, while the app
 * imported 0.18's stylesheet, which no longer defines `.katex .base`. Nothing
 * failed, and the only page with math is a draft, so no preview showed it.
 *
 * Reading velite's output rather than a rendered page is deliberate:
 * the fixture stays `draft: true` and never ships, but its markup is still
 * generated on every build.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

const FIXTURE = '.velite/blog.json'
const STATIC_DIR = '.next/static'

/** Markup that must be produced, as class -> what it proves. */
const REQUIRED_CLASSES = {
  katex: 'inline math (remark-math + rehype-katex)',
  'katex-display': 'display math block',
  'remark-code-title': 'code block titles (remark-code-titles)',
  'code-line': 'code blocks (rehype-prism-plus)',
  'highlight-line': 'code line highlighting',
  'line-number': 'code line numbers',
  token: 'syntax highlighting tokens',
  'csl-entry': 'citations (rehype-citation)',
  footnotes: 'footnotes (remark-gfm)',
}

/** Emitted class -> CSS selector that must exist to style it. */
const REQUIRED_STYLES = {
  base: '.katex .base',
  'katex-display': '.katex-display',
  'remark-code-title': '.remark-code-title',
  'code-line': '.code-line',
  'highlight-line': '.highlight-line',
  'line-number': '.line-number',
  token: '.token',
  'csl-entry': '.csl-entry',
  footnotes: '.footnotes',
}

const fail = (msg) => {
  console.error(`\n  ✖ rendering check failed\n\n${msg}\n`)
  process.exit(1)
}

if (!existsSync(FIXTURE)) {
  fail(`  Could not find ${FIXTURE}\n` + `  Velite produced no output. Run \`velite build\` first.`)
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')).find(
  (doc) => doc.slug === 'rendering-reference'
)
if (!fixture) {
  fail(
    `  data/blog/rendering-reference.mdx produced no entry in ${FIXTURE}\n` +
      `  If the fixture was deleted, remove this check from the build script too.`
  )
}
const code = fixture.body.code

// Compiled MDX emits classes as className:"a b c" — parse them rather than
// substring-matching, which false-positives ("base" inside "rebase").
const emitted = new Set()
for (const match of code.matchAll(/className:"([^"]+)"/g)) {
  for (const cls of match[1].split(/\s+/)) emitted.add(cls)
}

const missingMarkup = Object.entries(REQUIRED_CLASSES)
  .filter(([cls]) => !emitted.has(cls))
  .map(([cls, what]) => `    .${cls} — ${what}`)

if (missingMarkup.length) {
  fail(
    `  These features produced no markup in the rendering fixture:\n\n` +
      missingMarkup.join('\n') +
      `\n\n  A markdown plugin is likely broken or was removed.`
  )
}

/**
 * Collect every emitted stylesheet.
 *
 * Walked rather than read from a fixed directory: webpack emitted to
 * .next/static/css, Turbopack emits to .next/static/chunks, and pinning either
 * one makes this check silently find nothing after a Next upgrade.
 */
const collectCss = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectCss(full)
    return entry.name.endsWith('.css') ? [full] : []
  })

if (!existsSync(STATIC_DIR)) {
  fail(`  Could not find ${STATIC_DIR} — run this after \`next build\`.`)
}

const cssFiles = collectCss(STATIC_DIR)
if (cssFiles.length === 0) {
  fail(`  No stylesheets found under ${STATIC_DIR} — the build may have changed its output layout.`)
}
const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n')

/**
 * Whether `selector` appears in the stylesheet as a whole selector.
 *
 * A plain substring test would accept a longer class that merely starts with
 * it — `.katex .baseline` would satisfy `.katex .base`, and `.token-list`
 * would satisfy `.token` — silently defeating the drift check. Requiring the
 * next character to be something that cannot continue a class name (so `{`
 * `,` `:` `.` `>` `+` `~` `[` or whitespace) rules that out, while still
 * matching compound selectors such as `.token.comment`.
 */
const hasRule = (selector) =>
  new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(css)

const unstyled = Object.entries(REQUIRED_STYLES)
  .filter(([cls, selector]) => emitted.has(cls) && !hasRule(selector))
  .map(([cls, selector]) => `    class "${cls}" is emitted, but "${selector}" has no rule`)

if (unstyled.length) {
  fail(
    `  Markup and stylesheet have drifted apart:\n\n` +
      unstyled.join('\n') +
      `\n\n  This usually means a package that renders markup and a package that\n` +
      `  ships its stylesheet resolved to different versions. Check for duplicates:\n` +
      `    npm ls katex`
  )
}

console.log(
  `Rendering check passed (${Object.keys(REQUIRED_CLASSES).length} features, ` +
    `${Object.keys(REQUIRED_STYLES).length} style couplings).`
)
