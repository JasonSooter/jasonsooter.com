import type { MDXComponents } from 'mdx/types'
import * as jsxRuntime from 'react/jsx-runtime'

/**
 * Renders MDX compiled by velite.
 *
 * Replaces pliny's MDXLayoutRenderer, which cannot be reused: it builds the
 * component with `new Function('React', 'ReactDOM', '_jsx_runtime', code)` and
 * passes React first, matching contentlayer's output. Velite instead emits
 *
 *   const { Fragment, jsx, jsxs } = arguments[0]
 *   ...
 *   return { default: Component }
 *
 * so the JSX runtime has to be the first argument.
 *
 * Deliberately a server component, like pliny's was. Marking it `'use client'`
 * puts an RSC boundary between the page and the `components` map, and React
 * refuses to serialise those functions ("Functions cannot be passed directly to
 * Client Components"). Everything here runs at build time, so no hook is needed.
 */
const cache = new Map<string, React.ComponentType<Record<string, unknown>>>()

/**
 * Compiled MDX is a stable string, so the component built from it is cached by
 * that string. Without this each render produces a fresh component identity,
 * which Next 16's React compiler rules reject ("Cannot create components
 * during render") because it would remount the subtree on every render.
 */
const getMDXComponent = (code: string) => {
  let Component = cache.get(code)
  if (!Component) {
    Component = new Function(code)(jsxRuntime).default
    cache.set(code, Component!)
  }
  return Component!
}

type MDXContentProps = {
  code: string
  components?: MDXComponents
  [key: string]: unknown
}

export default function MDXContent({ code, components, ...rest }: MDXContentProps) {
  const Component = getMDXComponent(code)
  return <Component components={components} {...rest} />
}
