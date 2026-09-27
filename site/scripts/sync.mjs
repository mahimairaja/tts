// Builds the site's data from README.md. The README is the product: every word, table and link
// on the site comes from it. A README whose shape this parser does not recognise stops the build
// here, so the site never publishes a half-read page.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const site = resolve(here, '..');
const REPO_URL = 'https://github.com/mahimairaja/tts';

const readme = readFileSync(resolve(repo, 'README.md'), 'utf8');
const problems = [];
const need = (value, what) => {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) {
    problems.push(`Could not find ${what} in README.md.`);
  }
  return value;
};

// --- Sections ------------------------------------------------------------------------------
// "## ⚡ 4. Streaming and low-latency synthesis" -> { num: 4, emoji, title, slug }. GitHub's
// anchor for that heading is "-4-streaming-and-low-latency-synthesis"; links to it are rewritten
// to the section's own page.
const githubSlug = (s) =>
  s
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    // No trim: GitHub keeps the space the emoji leaves, which is why the anchor starts with "-".
    .replace(/\s/g, '-');
const pageSlug = (title) => githubSlug(title).replace(/^-+|-+$/g, '').replace(/-+/g, '-');

// Every "## " heading ends the section before it, numbered or not ("Suggested learning path").
const allHeadings = [...readme.matchAll(/^## .+$/gm)];
const bodyAfter = (m) => {
  const start = m.index + m[0].length;
  const next = allHeadings.find((h) => h.index > m.index);
  return readme
    .slice(start, next ? next.index : readme.length)
    .trim()
    .replace(/\n---$/, '')
    .trim();
};
const headings = [...readme.matchAll(/^## (\S+) (\d+)\. (.+)$/gm)];
need(headings, 'numbered "## <emoji> N. Title" sections');
const sections = headings.map((m) => {
  const [, emoji, num, title] = m;
  return { num: Number(num), emoji, title, slug: pageSlug(title), anchor: githubSlug(`${emoji} ${num}. ${title}`), body: bodyAfter(m) };
});
const named = (title) => {
  const m = allHeadings.find((h) => h[0] === `## ${title}`);
  return need(m && bodyAfter(m), `the "## ${title}" section`);
};
const anchorToPage = Object.fromEntries(sections.map((s) => [`#${s.anchor}`, `/${s.slug}/`]));

// --- Markdown ------------------------------------------------------------------------------
const LEVELS = { '🟢': ['beginner', 'Beginner'], '🟡': ['intermediate', 'Intermediate'], '🔴': ['advanced', 'Advanced'] };
// Raw HTML the README uses on purpose. Anything else in angle brackets is text, such as the
// "<laugh>" emotion tags a model description names, and is escaped so it stays visible.
const ALLOWED_TAGS = /^<\/?(details|summary|b|br|div|picture|source|img|a|p)\b/i;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const siteUrl = (href = '') => {
  if (anchorToPage[href]) return anchorToPage[href];
  if (href.startsWith('#')) return `${REPO_URL}${href}`;
  if (!/^[a-z]+:/i.test(href) && !href.startsWith('/')) return `${REPO_URL}/blob/main/${href.replace(/^\.\//, '')}`;
  return href;
};
const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const url = siteUrl(href);
      const external = /^https?:/i.test(url);
      const t = title ? ` title="${title}"` : '';
      return `<a href="${url}"${t}${external ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
    },
    html({ text }) {
      return ALLOWED_TAGS.test(text.trim()) ? text : esc(text);
    },
  },
});
// "🟢" becomes a labelled dot; "🟢 Beginner", as the legend writes it, keeps one name, not two.
const levelSpans = (html) =>
  html.replace(/(🟢|🟡|🔴)(?: (?:Beginner|Intermediate|Advanced)\b)?/gu, (_, e) => `<span class="level" data-level="${LEVELS[e][0]}">${LEVELS[e][1]}</span>`);
const md = (text) => levelSpans(marked.parse(text));
const inline = (text) => levelSpans(marked.parseInline(text.trim()));
const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Everything inside <details> is shown open on the site.
const expandDetails = (body) =>
  body
    .replace(/<summary>.*?<\/summary>/g, '')
    .replace(/<\/?details>/g, '')
    .trim();
const introOf = (body) => body.split(/^<details>/m)[0].trim();
const tableRows = (text) =>
  text
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) =>
      l
        .trim()
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((c) => c.trim()),
    )
    .filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));

// --- Resources ------------------------------------------------------------------------------
// "- 🟡 [Title](url): Description" under a "### Group" heading. Section 17 carries no level tag.
const RESOURCE = /^- (?:(🟢|🟡|🔴) )?\[(.+?)\]\((\S+?)\):\s*(.+)$/u;
const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
const resourcesIn = (s) => {
  let group = null;
  const out = [];
  for (const line of s.body.split('\n')) {
    const h = line.match(/^### (.+)$/);
    if (h) group = h[1].trim();
    const r = line.match(RESOURCE);
    if (!r) continue;
    const [, level, title, url, description] = r;
    out.push({
      title: plain(title),
      url,
      domain: domainOf(url),
      html: inline(description),
      text: plain(description),
      level: level ? LEVELS[level][0] : null,
      levelTo: null,
      // The README's own flag for an author who sells what they write about.
      commercial: /commercial author/i.test(description),
      group,
    });
  }
  return out;
};

// --- Hero -------------------------------------------------------------------------------------
const alt = need(readme.match(/alt="([^"]+)"/)?.[1], 'the banner alt text');
const [name, headlineRaw = ''] = (alt ?? '').split(/:\s*/);
const lede = need(readme.match(/^\*\*(A curated[^\n]+?)\*\*$/m)?.[1], 'the bold one-line description under the banner');
const preamble = readme.split(/^---$/m)[0].split('</div>').pop().trim().split('\n\n');
const levelLine = preamble.find((p) => /🟢 Beginner/u.test(p));
const introParas = preamble.filter((p) => p !== levelLine);
need(introParas, 'the introduction under the banner');
// The hero shows the opening paragraph's structure, not its prose: the two fields it names
// ("One is **real-time synthesis**, judged by ..., where ...") and the line that ties them.
const opening = introParas[0] ?? '';
const side = (lead) => {
  const m = opening.match(new RegExp(`${lead} \\*\\*(.+?)\\*\\*, (.+?), where `));
  return m && { term: m[1].charAt(0).toUpperCase() + m[1].slice(1), judged: m[2].charAt(0).toUpperCase() + m[2].slice(1) + '.' };
};
const split = [need(side('One is'), 'the "One is **...**, judged by ..." sentence in the introduction'), need(side('The other is'), 'the "The other is **...**" sentence in the introduction')];
const moral = need(opening.match(/(A model that wins one loses the other)[,.]/)?.[1], 'the "A model that wins one loses the other" line in the introduction');
need(levelLine, 'the level legend (🟢 Beginner, 🟡 Intermediate, 🔴 Advanced)');

// --- Section 2: providers, each with a real-time or offline lean -------------------------------
const providersSection = sections.find((s) => s.num === 2);
const [provHeader, ...provRows] = tableRows(introOf(providersSection?.body ?? ''));
need(provRows, 'the provider table in section 2');
if (provHeader && provHeader.join('|') !== 'Provider|Lean|Best for') problems.push('Section 2 table columns changed; expected Provider | Lean | Best for.');
const providers = provRows.map(([p, lean, bestFor]) => ({ name: plain(p), lean: lean.trim().toLowerCase(), bestFor: inline(bestFor) }));
for (const p of providers.filter((x) => !['real-time', 'offline', 'both'].includes(x.lean))) {
  problems.push(`Section 2: "${p.name}" has lean "${p.lean}"; expected real-time, offline or both.`);
}

// --- Section 3: open models and their weight licenses ------------------------------------------
// Grouped by what the License column says about shipping: a non-commercial, research, capped or
// separately granted license blocks production use; GPL is copyleft; the rest are permissive.
const modelsSection = sections.find((s) => s.num === 3);
const [modHeader, ...modRows] = tableRows(introOf(modelsSection?.body ?? ''));
need(modRows, 'the open model table in section 3');
if (modHeader && modHeader.join('|') !== 'Model|License|Best for') problems.push('Section 3 table columns changed; expected Model | License | Best for.');
const licenseClass = (l) => (/non-commercial|\bNC\b|-NC|research|\bcap\b|grant/i.test(l) ? 'restricted' : /GPL/.test(l) ? 'copyleft' : 'permissive');
const models = modRows.map(([m, license, bestFor]) => ({ name: plain(m), license: plain(license), kind: licenseClass(license), bestFor: inline(bestFor) }));

// --- Section 4: first-byte latency, and the streaming table ------------------------------------
const streamingSection = sections.find((s) => s.num === 4);
const streamIntro = streamingSection?.body.split('\n\n')[0] ?? '';
const firstByte = {
  budget: Number(need(streamIntro.match(/in under (\d+) ms/)?.[1], 'the "under N ms" budget in section 4')),
  slow: Number(need(streamIntro.match(/a (\d+) ms first byte/)?.[1], 'the slow first byte ("a N ms first byte") in section 4')),
  fast: Number(need(streamIntro.match(/starts speaking at (\d+) ms/)?.[1], 'the fast first byte ("starts speaking at N ms") in section 4')),
  html: md(streamIntro),
  // The paragraph's bold sentence, the one claim the timeline draws.
  claimHtml: inline(
    (need(streamIntro.match(/\*\*(.+?)\*\*/)?.[1], 'the bold claim in the section 4 intro') ?? '').replace(/^./, (c) => c.toUpperCase()) + '.',
  ),
};
const streamBlock = streamingSection?.body.split(/^### Provider streaming capabilities/m)[1]?.split(/^### /m)[0] ?? '';
const [streamHeader = [], ...streamRows] = tableRows(streamBlock);
need(streamRows, 'the provider streaming table in section 4');
// The table's own intro is written for contributors ("keep the columns honest"), so the site
// leads with the paragraph that tells a reader how far to trust it.
const benchIntro = streamingSection?.body.split(/^### Benchmarking TTFB yourself/m)[1]?.trim().split('\n\n')[0];
const streaming = {
  introHtml: md(need(benchIntro, 'the "Benchmarking TTFB yourself" paragraph in section 4') ?? ''),
  columns: streamHeader,
  rows: streamRows,
  noteHtml: md(need(streamBlock.match(/^> (.+)$/m)?.[1], 'the note under the streaming table in section 4') ?? ''),
};

// --- Learning path and contributing ------------------------------------------------------------
const pathBody = named('Suggested learning path') ?? '';
const path = [...pathBody.matchAll(/^\d+\. \*\*(.+?):\*\* (.+)$/gm)].map(([, label, text]) => ({
  label,
  // "read the front-end ..." follows a bold label in the README; on its own line it starts a sentence.
  html: inline((text.charAt(0).toUpperCase() + text.slice(1)).replace(/\s*\(sections? [\d, ]+\)\.?$/, '.')),
  sections: [...(text.match(/\(sections? ([\d, ]+)\)/)?.[1] ?? '').matchAll(/\d+/g)].map(Number),
}));
need(path, 'the numbered steps in "Suggested learning path"');
const contributing = named('Contributing') ?? '';

// --- Stars (optional) -------------------------------------------------------------------------
let stars = null;
try {
  const res = await fetch('https://api.github.com/repos/mahimairaja/tts', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'tts-site' },
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) stars = (await res.json()).stargazers_count ?? null;
} catch {
  // offline or rate limited
}

const outSections = sections.map((s) => {
  const resources = resourcesIn(s);
  // The README's own count ("<b>8 resources</b>"), checked against the entries found.
  const stated = s.body.match(/<summary><b>(\d+) resources<\/b><\/summary>/)?.[1];
  if (stated && Number(stated) !== resources.length) {
    problems.push(`Section ${s.num} says ${stated} resources but lists ${resources.length}.`);
  }
  const intro = introOf(s.body);
  // A section that is an intro plus one collapsed list renders as a searchable list; one with
  // prose between its lists (section 4) renders in full.
  const listOnly = Boolean(stated) && s.body.split(/^<details>/m).length === 2;
  return {
    num: s.num,
    emoji: s.emoji,
    title: s.title,
    slug: s.slug,
    intro: plain(intro.split('\n\n')[0]),
    introHtml: md(intro.split('\n\n')[0]),
    leadHtml: listOnly ? md(intro) : null,
    html: md(expandDetails(s.body)),
    groups: [...new Set(resources.map((r) => r.group).filter(Boolean))],
    count: resources.length,
    resources,
  };
});

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error('\nThe site is built from README.md; fix its structure before building.');
  process.exit(1);
}

const data = {
  repo: REPO_URL,
  hero: {
    name,
    headline: headlineRaw.charAt(0).toUpperCase() + headlineRaw.slice(1),
    lede,
    introHtml: introParas.map((p) => md(p)).join(''),
    split,
    moral: moral ? `${moral}.` : '',
    levelsHtml: md(levelLine),
  },
  providers: { introHtml: md(introOf(providersSection.body).split('\n\n')[0]), rows: providers },
  models: { introHtml: md(introOf(modelsSection.body).split('\n\n')[0]), rows: models },
  firstByte,
  streaming,
  path,
  contributingHtml: md(contributing),
  sections: outSections,
  count: outSections.reduce((n, s) => n + s.count, 0),
  stars,
};

mkdirSync(resolve(site, 'src/data'), { recursive: true });
writeFileSync(resolve(site, 'src/data/readme.json'), JSON.stringify(data, null, 2) + '\n');

// Social card: the repository's own banner, framed at 1200 x 630.
mkdirSync(resolve(site, 'public'), { recursive: true });
await sharp(resolve(repo, 'docs/assets/banner-dark.webp'))
  .resize(1200, 630, { fit: 'contain', background: '#0a0a0a' })
  .png()
  .toFile(resolve(site, 'public/og.png'));

console.log(
  `Synced ${outSections.length} sections, ${data.count} resources, ${providers.length} providers, ${models.length} open models, ` +
    `${streaming.rows.length} streaming rows, ${path.length} path steps. Stars: ${stars ?? 'unknown'}.`,
);
