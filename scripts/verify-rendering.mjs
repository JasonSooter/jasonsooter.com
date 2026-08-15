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
 * Reading contentlayer's output rather than a rendered page is deliberate:
 * the fixture stays `draft: true` and never ships, but its markup is still
 * generated on every build.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

const FIXTURE = '.contentlayer/generated/Blog/blog__rendering-reference.mdx.json'
const CSS_DIR = '.next/static/css'

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
  fail(
    `  Could not find ${FIXTURE}\n` +
      `  The rendering fixture is missing. If data/blog/rendering-reference.mdx\n` +
      `  was deleted, remove this check from the build script too.`
  )
}

const code = JSON.parse(readFileSync(FIXTURE, 'utf8')).body.code

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

if (!existsSync(CSS_DIR)) {
  fail(`  Could not find ${CSS_DIR} — run this after \`next build\`.`)
}

const css = readdirSync(CSS_DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(path.join(CSS_DIR, f), 'utf8'))
  .join('\n')

const unstyled = Object.entries(REQUIRED_STYLES)
  .filter(([cls, selector]) => emitted.has(cls) && !css.includes(selector))
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
