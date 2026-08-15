import { NewsletterAPI } from 'pliny/newsletter'
import siteMetadata from '@/data/siteMetadata'

const handler = NewsletterAPI({
  // @ts-expect-error pliny types the provider as a literal union, but the value
  // comes from siteMetadata and widens to string.
  provider: siteMetadata.newsletter.provider,
})

export { handler as GET, handler as POST }
