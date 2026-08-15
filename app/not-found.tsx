import Link from '@/components/Link'

const suggestions = [
  { href: '/blog', title: 'Blog' },
  { href: '/tags', title: 'Tags' },
  { href: '/projects', title: 'Projects' },
  { href: '/about', title: 'About' },
]

export default function NotFound() {
  return (
    <div className="flex flex-col items-start justify-start md:mt-24 md:flex-row md:items-center md:justify-center md:space-x-6">
      <div className="space-y-2 pt-6 pb-8 md:space-y-5">
        <h1 className="text-6xl leading-9 font-extrabold tracking-tight text-gray-900 md:border-r-2 md:border-gray-200 md:px-6 md:text-8xl md:leading-14 dark:text-gray-100 dark:md:border-gray-700">
          404
        </h1>
      </div>
      <div className="max-w-md">
        <p className="mb-4 text-xl leading-normal font-bold md:text-2xl">
          Sorry, we couldn&apos;t find this page.
        </p>
        <p className="mb-8 text-gray-500 dark:text-gray-400">
          The page may have moved, or the link may be out of date. Here are a few places worth
          trying instead.
        </p>
        <Link
          href="/"
          className="bg-primary-500 hover:bg-primary-600 dark:hover:bg-primary-400 focus-visible:ring-primary-500 inline-block rounded-lg px-4 py-2 text-sm leading-5 font-medium text-white shadow-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
        >
          Back to homepage
        </Link>
        <nav aria-label="Other pages" className="mt-8">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {suggestions.map(({ href, title }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium"
                >
                  {title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
