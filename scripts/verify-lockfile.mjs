/**
 * Fails the build when package.json and package-lock.json disagree about a
 * direct dependency's version range.
 *
 * `npm install` — which Vercel runs — silently prefers the lockfile when the
 * two disagree, so a dependency PR whose lockfile update failed builds green
 * while installing the *old* version. Renovate's eslint v10 PR did exactly
 * that: package.json said "^10.0.0", the lockfile still pinned 9.39.5, and
 * Vercel installed eslint 9 and passed.
 *
 * `npm ci` would catch it, but cannot be used here: npm resolves a different
 * optional-dependency tree on linux than on darwin (@emnapi/core and
 * @emnapi/runtime get hoisted to the root at a different version), so a
 * lockfile generated on macOS never satisfies `npm ci` on Vercel. This check
 * compares only the declared ranges for direct dependencies, which is
 * platform-independent.
 */
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))

const root = lock.packages?.['']
if (!root) {
  console.error('\n  ✖ lockfile check failed\n\n  package-lock.json has no root package entry.\n')
  process.exit(1)
}

const drift = []
for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, declared] of Object.entries(pkg[field] ?? {})) {
    const locked = root[field]?.[name]
    if (locked === undefined) {
      drift.push(`    ${name}: package.json declares "${declared}", missing from the lockfile`)
    } else if (locked !== declared) {
      drift.push(`    ${name}: package.json declares "${declared}", lockfile records "${locked}"`)
    }
  }
}

if (drift.length) {
  console.error(
    `\n  ✖ lockfile check failed\n\n` +
      `  package.json and package-lock.json disagree:\n\n${drift.join('\n')}\n\n` +
      `  The installed version follows the lockfile, so the build would use a\n` +
      `  different version than package.json declares. Run \`npm install\` and\n` +
      `  commit the updated lockfile.\n`
  )
  process.exit(1)
}

console.log(
  `Lockfile check passed (${
    Object.keys(root.devDependencies ?? {}).length + Object.keys(root.dependencies ?? {}).length
  } direct dependencies in sync).`
)
