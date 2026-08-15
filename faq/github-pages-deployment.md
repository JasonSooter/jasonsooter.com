# How do I deploy on Github pages?

[Demo](https://timlrx.github.io/tailwind-nextjs-starter-blog/) & [Source](https://github.com/timlrx/tailwind-nextjs-starter-blog/tree/test-gh-pages-static)

1. Follow the section on creating a static build in the main README and test it locally to ensure that it works.
2. Specify the base path in `next.config.js` to match your repository name e.g. `basePath: "/tailwind-nextjs-starter-blog"`.
3. Modify `component/Image.tsx` to use the correct base path for the image source:

   ```tsx
   import NextImage, { ImageProps } from 'next/image'

   const Image = ({ src, ...rest }: ImageProps) => (
     <NextImage src={`/tailwind-nextjs-starter-blog${src}`} {...rest} />
   )

   export default Image
   ```

4. To automate deployment, here's a Github action that you could use

```yml
# Sample workflow for building and deploying a Next.js site to GitHub Pages
#
# To get started with Next.js see: https://nextjs.org/docs/getting-started
#
name: Deploy Next.js site to Pages

on:
  # Runs on pushes targeting the default branch
  push:
    branches: ['test-gh-pages-static']

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  # Build job
  build:
    name: Build Nextjs Blog
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '24'
          cache: npm
      - name: Restore cache
        uses: actions/cache@v3
        with:
          path: |
            .next/cache
          # Generate a new cache whenever packages or source files change.
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**.[jt]s', '**.[jt]sx') }}
          # If source files changed but packages didn't, rebuild from a prior cache.
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-
      - name: Install dependencies
        run: npm ci
      - name: Build project assets
        run: npm run build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: ./out

  # Deployment job
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```
