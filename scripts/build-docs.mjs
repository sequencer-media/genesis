import {readFile, writeFile, mkdir, cp, access, readdir} from 'node:fs/promises';
import {resolve, dirname, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Marked} from 'marked';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
if (outIndex >= 0 && !args[outIndex + 1]) throw new Error('Choose a documentation output directory.');
const output = resolve(root, outIndex >= 0 ? args[outIndex + 1] : 'docs');
const pages = [
  {source:'docs/index.md', file:'index.html', title:'GENESIS', description:'Open source World Model game engine. Create infinite experiences, in minutes.', group:'Start here', label:'Overview'},
  {source:'docs/getting-started.md', file:'getting-started.html', title:'Build your first world', group:'Start here'},
  {source:'docs/world-memory.md', file:'world-memory.html', title:'World memory', group:'Start here'},
  {source:'docs/agent-skill.md', file:'agent-skill.html', title:'Build from one prompt', group:'Start here'},
  {source:'docs/demos.md', file:'demos.html', title:'Worldstreams demos', group:'Start here'},
  {source:'docs/integration.md', file:'integration.html', title:'Worldstreams API', group:'Connect'},
  {source:'docs/providers.md', file:'providers.html', title:'Your own models', group:'Connect'},
  {source:'docs/api.md', file:'api.html', title:'SDK API reference', group:'Reference'},
  {source:'docs/architecture.md', file:'architecture.html', title:'Architecture', group:'Reference'},
  {source:'docs/host-authority.md', file:'host-authority.html', title:'Hosting and authority', group:'Reference'},
  {source:'docs/project-boundary.md', file:'project-boundary.html', title:'Portable projects', group:'Reference'},
  {source:'docs/compatibility.md', file:'compatibility.html', title:'Compatibility', group:'Reference'},
  {source:'AGENTS.md', file:'authoring-rules.html', title:'Authoring contract', group:'Reference'},
  {source:'CONTRIBUTING.md', file:'contributing.html', title:'Contributing', group:'Open source'},
  {source:'SECURITY.md', file:'security.html', title:'Security', group:'Open source'},
  {source:'LICENSE', file:'license.html', title:'Apache 2.0 license', group:'Open source'},
  {source:'README.md', file:'readme.html', title:'Project README', group:'Open source'}
];
const sourceRoutes = new Map(pages.map(page => [resolve(root, page.source), page.file]));
sourceRoutes.set(resolve(root, 'skills/create-world-stream/SKILL.md'), 'agent-skill.html');
const template = await readFile(resolve(root, 'docs/site/template.html'), 'utf8');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const brandNames = html => html.replace(/(^|>)([^<]+)(?=<|$)/g, (_all, start, text) => start + text.replace(/\b(GENESIS|Worldstreams|Sequencer)\b/g, '<span class="brand-name">$1</span>'));
const entities = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"};
const plain = value => value.replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_all, entity) => {
  if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
  const code = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).replace(/\s+/g, ' ').trim();
const slug = value => plain(value).toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
const generated = new Map();
const search = [];
await mkdir(output, {recursive:true});

function rewriteUrl(url, source) {
  if (url.startsWith('#') || /^(https?:|mailto:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) throw new Error('Unsupported documentation URL: ' + url);
  const match = /^([^?#]*)(.*)$/.exec(url);
  const target = resolve(dirname(resolve(root, source)), decodeURIComponent(match[1]));
  const route = sourceRoutes.get(target);
  if (route) return route + match[2];
  const portable = relative(resolve(root, 'docs'), target).split(sep).join('/');
  if (portable.startsWith('../')) throw new Error('Unmapped documentation resource: ' + url);
  return portable + match[2];
}

function navigation(current) {
  let group = '';
  return pages.map(page => {
    const heading = page.group === group ? '' : '<p class="nav-group">' + escape(page.group) + '</p>';
    group = page.group;
    const active = page.file === current ? ' aria-current="page" class="active"' : '';
    return heading + '<a href="' + page.file + '"' + active + '>' + brandNames(escape(page.label || page.title)) + '</a>';
  }).join('\n');
}

for (const page of pages) {
  const source = await readFile(resolve(root, page.source), 'utf8');
  const headings = [];
  const usedIds = new Map();
  const markdown = new Marked({gfm:true, async:false});
  markdown.use({useNewRenderer:true, renderer:{
    heading({tokens, depth}) {
      const label = brandNames(this.parser.parseInline(tokens));
      const base = slug(label) || 'section';
      const count = usedIds.get(base) || 0;
      usedIds.set(base, count + 1);
      const id = base + (count ? '-' + count : '');
      if (depth === 2 || depth === 3) headings.push({id, text:plain(label), depth});
      return '<h' + depth + ' id="' + id + '">' + label + '</h' + depth + '>\n';
    },
    link({href, title, tokens}) {
      return '<a href="' + escape(rewriteUrl(href, page.source)) + '"' + (title ? ' title="' + escape(title) + '"' : '') + '>' + this.parser.parseInline(tokens) + '</a>';
    },
    image({href, title, text}) {
      return '<img src="' + escape(rewriteUrl(href, page.source)) + '" alt="' + escape(text) + '"' + (title ? ' title="' + escape(title) + '"' : '') + ' loading="lazy">';
    },
    code({text, lang}) {
      const language = /^[a-z0-9_-]+$/i.test(lang || '') ? lang : 'text';
      return '<div class="code-block"><button type="button" data-copy-code aria-label="Copy code">Copy</button><pre><code class="language-' + language + '">' + escape(text) + '</code></pre></div>\n';
    }
  }});
  let input = source;
  if (page.source === 'docs/agent-skill.md') {
    const skill = await readFile(resolve(root, 'skills/create-world-stream/SKILL.md'), 'utf8');
    input += '\n\n## Authoring instructions\n\n' + skill.replace(/^---\n[\s\S]*?\n---\n/, '');
  }
  let body = page.source === 'LICENSE' ? '<h1>Apache 2.0 license</h1><p>GENESIS is open source, licensed under Apache 2.0.</p><pre class="license-text">' + escape(source) + '</pre>' : markdown.parse(input);
  // HTML cards are authored in the guide sources; give their headings stable anchors too.
  body = body.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_all, depth, label) => {
    const base = slug(label) || 'section';
    const count = usedIds.get(base) || 0;
    usedIds.set(base, count + 1);
    return '<h' + depth + ' id="' + base + (count ? '-' + count : '') + '">' + brandNames(label) + '</h' + depth + '>';
  });
  const toc = page.file === 'index.html' || page.file === 'demos.html' || !headings.length ? '' :
    '<details class="page-toc"><summary>On this page</summary><nav aria-label="Page sections">' +
    headings.map(heading => '<a href="#' + heading.id + '">' + escape(heading.text) + '</a>').join('') + '</nav></details>';
  const values = {
    TITLE:escape(page.file === 'index.html' ? 'GENESIS · Open Source World Model Game Engine' : page.title + ' · GENESIS'),
    DESCRIPTION:escape(page.description || page.title + '. GENESIS open source World Model game engine documentation.'),
    NAV:navigation(page.file), BODY:toc + body, PAGE:page.file === 'index.html' ? 'home-page' : 'guide-page', VERSION:escape(version)
  };
  const html = template.replace(/\{\{([A-Z]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error('Unknown documentation placeholder: ' + key);
    return values[key];
  });
  generated.set(page.file, html);
  await writeFile(resolve(output, page.file), html);
  if (page.file !== 'license.html' && page.file !== 'readme.html') {
    const primaryHeading = plain((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(body) || [null, page.title])[1]);
    search.push({title:page.title, heading:primaryHeading, url:page.file, text:plain(body).slice(0, 1400)});
    for (const heading of headings) {
      const start = body.indexOf('id="' + heading.id + '"');
      const headingEnd = body.indexOf('>', body.indexOf('</h', start)) + 1;
      const section = body.slice(headingEnd).split(/<h[1-3]\b/)[0];
      search.push({title:page.title + ' / ' + heading.text, heading:heading.text, url:page.file + '#' + heading.id, text:(heading.text + ' ' + plain(section)).slice(0, 1600)});
    }
  }
}

for (const folder of ['assets', 'site']) {
  const from = resolve(root, 'docs', folder), to = resolve(output, folder);
  if (from !== to) await cp(from, to, {recursive:true});
}
// Retain linked source documents when exporting a standalone static site.
if (output !== resolve(root, 'docs')) {
  for (const file of await readdir(resolve(root, 'docs'))) {
    if (file.endsWith('.md')) await cp(resolve(root, 'docs', file), resolve(output, file));
  }
}
await mkdir(resolve(output, 'skills/create-world-stream'), {recursive:true});
await cp(resolve(root, 'skills/create-world-stream/SKILL.md'), resolve(output, 'skills/create-world-stream/SKILL.md'));
await writeFile(resolve(output, 'site/search-index.json'), JSON.stringify(search, null, 2) + '\n');

// Validate the navigable site, including section links, before reporting success.
let checked = 0;
for (const [file, html] of generated) {
  for (const [, raw] of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) {
    const url = raw.replaceAll('&amp;', '&');
    if (/^(https?:|mailto:)/i.test(url)) continue;
    const parsed = new URL(url, 'https://genesis.local/' + file);
    const target = decodeURIComponent(parsed.pathname.slice(1));
    const absolute = resolve(output, target);
    if (!absolute.startsWith(output + sep)) throw new Error('Documentation path escapes the site: ' + url);
    await access(absolute).catch(() => {throw new Error(file + ' links to a missing file: ' + url);});
    if (parsed.hash && generated.has(target)) {
      const id = decodeURIComponent(parsed.hash.slice(1));
      if (!generated.get(target).includes('id="' + id + '"')) throw new Error(file + ' links to a missing section: ' + url);
    }
    checked++;
  }
}
console.log('Built ' + pages.length + ' documentation pages and ' + search.length + ' searchable sections; verified ' + checked + ' local links.');
