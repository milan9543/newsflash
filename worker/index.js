/**
 * News Diary - Cloudflare Worker
 * Runs at 00:00 UTC daily, collects news, calls Anthropic API, commits JSON to GitHub.
 *
 * Required environment secrets (set in Cloudflare Dashboard or wrangler.toml):
 *   ANTHROPIC_API_KEY   - Anthropic API key
 *   GITHUB_TOKEN        - GitHub personal access token (repo scope)
 *   GITHUB_REPO         - e.g. "yourname/news-diary"
 */

const NEWS_SOURCES = {
  world: [
    { name: "BBC", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
    {
      name: "AP",
      url: "https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en",
    },
    {
      name: "Reuters",
      url: "https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en",
    },
    { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
  hungary: [
    { name: "Telex", url: "https://telex.hu/rss" },
    { name: "444", url: "https://444.hu/feed" },
    { name: "HVG", url: "https://hvg.hu/rss" },
    { name: "24.hu", url: "https://24.hu/feed/" },
  ],
};

// ─── RSS Parser ──────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  // Handles both <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const regex = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    "i",
  );
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAtomLink(xml) {
  const match = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/>/i);
  return match ? match[1].trim() : null;
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || extractAtomLink(block);
    const pubDate =
      extractTag(block, "pubDate") || extractTag(block, "published");
    if (title && link) items.push({ title, link, pubDate });
  }
  return items;
}

async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": "NewsDiary/1.0 (+https://github.com)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const items = parseRSS(xml)
      .filter((i) => {
        if (!i.pubDate) return true; // keep if no date
        const t = Date.parse(i.pubDate);
        return isNaN(t) || t >= cutoff;
      })
      .slice(0, 25);
    return items.map((i) => ({ ...i, source: source.name }));
  } catch (err) {
    console.error(`[fetchFeed] ${source.name} failed:`, err.message);
    return [];
  }
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

function buildPrompt(date, worldArticles, hungaryArticles) {
  const fmt = (arr) =>
    arr
      .map((a) => `SOURCE: ${a.source}\nTITLE: ${a.title}\nURL: ${a.link}`)
      .join("\n\n");

  return `You are an experienced news editor. Curate a daily news digest for ${date}.

From the WORLD articles below, select the 1–5 most globally significant stories.
From the HUNGARY articles below, select the 1–5 most important Hungarian stories.

Rules:
- Prefer hard news over opinion/analysis
- Order items by importance descending (most significant story first)
- If the same event is covered by multiple sources, merge them into one item: use the title/short_title from the primary or most authoritative source, and include ALL source URLs in the urls array (each with its source name and URL)
- When an event has both a main/breaking article and follow-up or reaction articles, prefer the original breaking article as the primary source — not the follow-up
- For each item provide a SHORT keyword (1–4 words, can be in Hungarian for Hungarian news) that acts as a category label — e.g. "US", "Ukraine", "MOL", "Kegyelmi botrány", "Ebola"
- Keep the original title language (English for world, Hungarian for Hungarian news)
- Write a short_title: a shortened, neutral version of the title in max 8 words, in the same language as the original
- All string values must be valid JSON: escape double quotes as \\", backslashes as \\\\, and avoid raw newlines or control characters inside strings

Call the save_digest tool with your selections.

WORLD ARTICLES:
${fmt(worldArticles)}

HUNGARY ARTICLES:
${fmt(hungaryArticles)}`;
}

const DIGEST_TOOL = {
  name: "save_digest",
  description: "Save the curated daily news digest.",
  input_schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD format" },
      world: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keyword: { type: "string" },
            title: { type: "string" },
            short_title: {
              type: "string",
              description: "Shortened title, max 8 words, neutral and factual",
            },
            urls: {
              type: "array",
              description: "One entry per source covering this story",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "News outlet name" },
                  url: { type: "string", description: "Direct article URL" },
                },
                required: ["name", "url"],
              },
            },
          },
          required: ["keyword", "title", "short_title", "urls"],
        },
      },
      hungary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keyword: { type: "string" },
            title: { type: "string" },
            short_title: {
              type: "string",
              description: "Shortened title, max 8 words, neutral and factual",
            },
            urls: {
              type: "array",
              description: "One entry per source covering this story",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "News outlet name" },
                  url: { type: "string", description: "Direct article URL" },
                },
                required: ["name", "url"],
              },
            },
          },
          required: ["keyword", "title", "short_title", "urls"],
        },
      },
    },
    required: ["date", "world", "hungary"],
  },
};

async function callAnthropic(prompt, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      tools: [DIGEST_TOOL],
      tool_choice: { type: "tool", name: "save_digest" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  if (data.stop_reason === "max_tokens") {
    console.error("[anthropic] Response truncated — hit max_tokens limit");
  }
  const toolUse = data.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use block in Anthropic response");
  return toolUse.input;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

async function commitToGitHub(date, payload, env) {
  const path = `news/${date}.json`;
  const apiBase = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "NewsDiary-Worker/1.0",
  };

  // Check if file already exists (get SHA for update)
  let sha;
  const check = await fetch(apiBase, { headers });
  if (check.ok) {
    const existing = await check.json();
    sha = existing.sha;
    console.log(`[github] File exists for ${date}, will update.`);
  }

  const body = {
    message: `news: add digest for ${date}`,
    content: btoa(
      unescape(encodeURIComponent(JSON.stringify(payload, null, 2))),
    ),
    ...(sha && { sha }),
  };

  const put = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!put.ok) {
    const err = await put.text();
    throw new Error(`GitHub commit failed ${put.status}: ${err}`);
  }
  console.log(`[github] Committed ${path} successfully.`);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default {
  // Cron trigger: 0 0 * * *  (midnight UTC)
  async scheduled(_event, env, _ctx) {
    // Yesterday in UTC
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const date = d.toISOString().slice(0, 10); // YYYY-MM-DD

    console.log(`[worker] Starting digest for ${date}`);

    // Fetch all feeds in parallel
    const [worldItems, hungaryItems] = await Promise.all([
      Promise.all(NEWS_SOURCES.world.map(fetchFeed)).then((r) => r.flat()),
      Promise.all(NEWS_SOURCES.hungary.map(fetchFeed)).then((r) => r.flat()),
    ]);

    console.log(
      `[worker] Fetched ${worldItems.length} world / ${hungaryItems.length} hungary articles`,
    );

    if (worldItems.length === 0 && hungaryItems.length === 0) {
      throw new Error("No articles fetched — aborting.");
    }

    // Ask Claude to curate
    const prompt = buildPrompt(date, worldItems, hungaryItems);
    const payload = await callAnthropic(prompt, env.ANTHROPIC_API_KEY);
    console.log(
      `[worker] Got ${payload.world?.length} world / ${payload.hungary?.length} hungary items from Claude`,
    );

    // Commit to GitHub
    await commitToGitHub(date, payload, env);
    console.log(`[worker] Done for ${date}.`);
    return payload;
  },

  // Optional: HTTP handler for manual triggering during development
  async fetch(request, env, _ctx) {
    if (request.method !== "POST") {
      return new Response("Send POST to trigger manually.", { status: 405 });
    }
    const payload = await this.scheduled(null, env, null);
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
