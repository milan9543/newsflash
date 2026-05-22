# News Diary

A personal daily news digest — curated by Claude, stored as JSON in GitHub, published as a static Astro site on Cloudflare Pages.

## Architecture

```
Cloudflare Worker (cron 00:00 UTC)
  → fetch RSS feeds (BBC, AP, Telex, Index, 444, HVG)
  → call Anthropic API (claude-opus-4-5)
  → commit news/YYYY-MM-DD.json to GitHub

GitHub commit
  → triggers Cloudflare Pages build
  → deploys static Astro site
```

## Pages

| URL | Description |
|-----|-------------|
| `/` | Redirects to `/yesterday` |
| `/yesterday` | Most recent digest entry |
| `/2026-05-22` | Any specific date |
| `/calendar` | Browse all dates |

## Data Format

Each `news/YYYY-MM-DD.json` file:

```json
{
  "date": "2026-05-22",
  "world": [
    { "keyword": "US",    "title": "...", "url": "https://..." },
    { "keyword": "Ebola", "title": "...", "url": "https://..." }
  ],
  "hungary": [
    { "keyword": "MOL", "title": "...", "url": "https://..." }
  ]
}
```

---

## Setup

### 1. GitHub Repo

Push this project to a new GitHub repo. The `news/` directory will be populated by the worker automatically.

### 2. Cloudflare Pages (Astro site)

1. Go to **Cloudflare Dashboard → Pages → Create a project**
2. Connect your GitHub repo
3. Build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Output directory**: `dist`

### 3. Cloudflare Worker

```bash
cd worker
npm install -g wrangler
wrangler login

# Set secrets
wrangler secret put ANTHROPIC_API_KEY   # your Anthropic key
wrangler secret put GITHUB_TOKEN        # GitHub PAT with repo scope
wrangler secret put GITHUB_REPO         # e.g. "yourname/news-diary"

# Deploy
wrangler deploy
```

The worker runs automatically at **00:00 UTC** every day via cron trigger.

### 4. Manual trigger (test)

```bash
curl -X POST https://your-worker.workers.dev
```

---

## News Sources

### World
- [BBC World](http://feeds.bbci.co.uk/news/world/rss.xml)
- [AP News](https://feeds.apnews.com/rss/apf-topnews)
- [Al Jazeera](https://www.aljazeera.com/xml/rss/all.xml)

### Hungary
- [Telex](https://telex.hu/rss)
- [Index](https://index.hu/24ora/rss/)
- [444](https://444.hu/feed)
- [HVG](https://hvg.hu/rss)

To add or remove sources, edit `NEWS_SOURCES` in `worker/index.js`.

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build
```

Add sample JSON files to `news/` to test locally.
