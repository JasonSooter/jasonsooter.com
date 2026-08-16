import { writeFileSync } from 'fs'
import { slug as slugify } from 'github-slugger'
import path from 'path'
import readingTime from 'reading-time'
import { defineCollection, defineConfig, s } from 'velite'
// Remark packages
import {
  extractTocHeadings,
  remarkCodeTitles,
  remarkExtractFrontmatter,
  remarkImgToJsx,
} from 'pliny/mdx-plugins/index.js'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
// Rehype packages
import { allCoreContent, sortPosts } from 'pliny/utils/contentlayer.js'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeCitation from 'rehype-citation'
import rehypeKatex from 'rehype-katex'
import rehypePresetMinify from 'rehype-preset-minify'
import rehypePrismPlus from 'rehype-prism-plus'
import rehypeSlug from 'rehype-slug'
import siteMetadata from './data/siteMetadata'

const root = process.cwd()
const isProduction = process.env.NODE_ENV === 'production'

/**
 * Fields contentlayer derived from `_raw`, reproduced from velite's `meta`.
 *
 * contentlayer's `flattenedPath` is the path below the content root without an
 * extension ("blog/alfred"); `sourceFilePath` keeps the extension. `slug` drops
 * the leading collection segment.
 */
const derived = (meta: { path: string }) => {
  const relative = path.relative(path.join(root, 'data'), meta.path)
  const flattenedPath = relative.replace(/\.mdx?$/, '')
  return {
    path: flattenedPath,
    slug: flattenedPath.replace(/^.+?(\/)/, ''),
    filePath: relative,
    // pliny's coreContent() omits these and types against contentlayer's
    // document shape, so they are reproduced rather than dropped.
    _id: relative,
    _raw: {
      sourceFilePath: relative,
      sourceFileName: path.basename(relative),
      sourceFileDir: path.dirname(relative),
      contentType: 'mdx',
      flattenedPath,
    },
  }
}

const blog = defineCollection({
  name: 'Blog',
  pattern: 'blog/**/*.mdx',
  schema: s
    .object({
      title: s.string(),
      date: s.isodate(),
      tags: s.array(s.string()).default([]),
      lastmod: s.isodate().optional(),
      draft: s.boolean().optional(),
      summary: s.string().optional(),
      images: s.any().optional(),
      authors: s.array(s.string()).optional(),
      layout: s.string().optional(),
      bibliography: s.string().optional(),
      canonicalUrl: s.string().optional(),
      raw: s.raw(),
      compiled: s.mdx(),
    })
    .transform(async (doc, { meta }) => {
      const { path: flattenedPath, slug, filePath, _id, _raw } = derived(meta as { path: string })
      const { raw, compiled, ...fields } = doc
      return {
        ...fields,
        // contentlayer nested the source and compiled output under `body`, and
        // pliny's coreContent() omits `body` wholesale. Keeping that shape is
        // what stops the compiled MDX being serialised into every listing page.
        body: { raw, code: compiled },
        path: flattenedPath,
        slug,
        filePath,
        _id,
        _raw,
        readingTime: readingTime(raw),
        toc: await extractTocHeadings(raw),
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: doc.title,
          datePublished: doc.date,
          dateModified: doc.lastmod || doc.date,
          description: doc.summary,
          image: doc.images ? doc.images[0] : siteMetadata.socialBanner,
          url: `${siteMetadata.siteUrl}/${flattenedPath}`,
        },
      }
    }),
})

const authors = defineCollection({
  name: 'Authors',
  pattern: 'authors/**/*.mdx',
  schema: s
    .object({
      name: s.string(),
      avatar: s.string().optional(),
      occupation: s.string().optional(),
      company: s.string().optional(),
      email: s.string().optional(),
      twitter: s.string().optional(),
      bluesky: s.string().optional(),
      linkedin: s.string().optional(),
      github: s.string().optional(),
      layout: s.string().optional(),
      raw: s.raw(),
      compiled: s.mdx(),
    })
    .transform(async (doc, { meta }) => {
      const { path: flattenedPath, slug, filePath, _id, _raw } = derived(meta as { path: string })
      const { raw, compiled, ...fields } = doc
      return {
        ...fields,
        // contentlayer nested the source and compiled output under `body`, and
        // pliny's coreContent() omits `body` wholesale. Keeping that shape is
        // what stops the compiled MDX being serialised into every listing page.
        body: { raw, code: compiled },
        path: flattenedPath,
        slug,
        filePath,
        _id,
        _raw,
        readingTime: readingTime(raw),
        toc: await extractTocHeadings(raw),
      }
    }),
})

/** Count tag occurrences across posts and write them for the tag pages. */
function createTagCount(allBlogs) {
  const tagCount: Record<string, number> = {}
  allBlogs.forEach((file) => {
    if (file.tags && (!isProduction || file.draft !== true)) {
      file.tags.forEach((tag) => {
        const formattedTag = slugify(tag)
        if (formattedTag in tagCount) {
          tagCount[formattedTag] += 1
        } else {
          tagCount[formattedTag] = 1
        }
      })
    }
  })
  writeFileSync('./app/tag-data.json', JSON.stringify(tagCount))
}

function createSearchIndex(allBlogs) {
  if (
    siteMetadata?.search?.provider === 'kbar' &&
    siteMetadata.search.kbarConfig.searchDocumentsPath
  ) {
    writeFileSync(
      `public/${siteMetadata.search.kbarConfig.searchDocumentsPath}`,
      JSON.stringify(allCoreContent(sortPosts(allBlogs)))
    )
    console.log('Local search index generated...')
  }
}

export default defineConfig({
  root: 'data',
  output: {
    data: '.velite',
    assets: 'public/static/velite',
    base: '/static/velite/',
    clean: true,
  },
  collections: { blog, authors },
  mdx: {
    remarkPlugins: [
      remarkExtractFrontmatter,
      remarkGfm,
      remarkCodeTitles,
      remarkMath,
      remarkImgToJsx,
    ],
    rehypePlugins: [
      rehypeSlug,
      rehypeAutolinkHeadings,
      rehypeKatex,
      // velite parses frontmatter itself, so remarkExtractFrontmatter never
      // populates vfile.data and rehype-citation cannot discover the per-post
      // `bibliography` field. There is a single site-wide bibliography, so it
      // is passed directly instead.
      [rehypeCitation, { bibliography: 'references-data.bib', path: path.join(root, 'data') }],
      [rehypePrismPlus, { defaultLanguage: 'js', ignoreMissing: true }],
      rehypePresetMinify,
    ],
  },
  complete: ({ blog }) => {
    createTagCount(blog)
    createSearchIndex(blog)
  },
})
