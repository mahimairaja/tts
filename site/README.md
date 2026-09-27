# tts.mahimai.ca

The website for this repository: Astro with React islands, served as static files from
Cloudflare Workers.

README.md is the product and this site only renders it. `npm run sync` (run by `dev` and
`build`) parses the README into `src/data/readme.json`: its numbered sections and every resource
in them, the provider table with each provider's real-time or offline lean, the open model table
with its licenses, the streaming table, and the learning path. It also checks each section's
stated resource count against the entries it finds. If the README's structure changes in a way
the parser cannot read, the build stops rather than publishing a half-read page. Edit the README,
not the site.

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # writes dist/
```
