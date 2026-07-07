# Korea Football Radar

Korea Football Radar is a Next.js dashboard for monitoring Korean football governance news and official-source metadata. It stores only metadata, short descriptions, tags, and original links in repository JSON files under `data/`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- pnpm
- GitHub Actions scheduled collector
- JSON data files, no database

## Local Development

```bash
pnpm install
pnpm run dev
```

Useful checks:

```bash
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run validate:data
pnpm run build
```

## Data Collection

Collectors write metadata into `data/items.json` and update `data/collection-state.json`.

```bash
pnpm run collect
pnpm run collect:naver
pnpm run collect:official
```

The Naver collector reads these environment variables:

```bash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

For GitHub Actions, add both values as repository secrets. Without them, the collector still runs official-source checks and skips Naver API calls.

## Deployment

The app is Vercel-ready with the default Next.js preset.

1. Import `gonasooc/k-football-radar` into Vercel.
2. Use the default build command: `pnpm run build`.
3. Keep output directory on the Vercel default.
4. Set production branch to `main`.
5. Do not add Naver API keys to Vercel for the MVP. Collection runs in GitHub Actions.

When GitHub Actions commits updated `data/`, Vercel Git integration redeploys the static pages.

## Safety Rules

- Do not store full article bodies.
- Do not copy article images.
- Do not add defamatory automatic labels.
- Every item must have an original http(s) link.
- Automatic tags are keyword matches and can be wrong.
