const searchInput = document.querySelector('#docs-search');
const results = document.querySelector('#search-results');
let indexPromise;
let revision = 0;

async function searchDocs() {
  const current = ++revision;
  const query = searchInput.value.trim().toLowerCase();
  results.replaceChildren();
  if (query.length < 2) {results.hidden = true; return;}
  results.hidden = false;
  try {
    indexPromise ||= fetch('site/search-index.json').then(response => {
      if (!response.ok) throw new Error('Search is unavailable.');
      return response.json();
    });
    const index = await indexPromise;
    if (current !== revision) return;
    const terms = query.split(/\s+/).slice(0, 8);
    const matches = index.map(entry => {
      const title = entry.title.toLowerCase(), heading = entry.heading.toLowerCase(), text = entry.text.toLowerCase();
      if (!terms.every(term => title.includes(term) || heading.includes(term) || text.includes(term))) return null;
      return {entry, score:terms.reduce((score, term) => score + (title.includes(term) ? 8 : heading.includes(term) ? 4 : 1), 0) + (entry.url.includes('#') ? 0 : 1)};
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 8);
    if (!matches.length) {const empty = document.createElement('p'); empty.textContent = 'No matching guides. Try a shorter search.'; results.append(empty); return;}
    for (const {entry} of matches) {
      const link = document.createElement('a'), title = document.createElement('strong'), excerpt = document.createElement('span');
      link.href = entry.url;
      title.textContent = entry.title;
      const first = Math.max(0, entry.text.toLowerCase().indexOf(terms[0]));
      const start = Math.max(0, first - 35);
      excerpt.textContent = (start ? '…' : '') + entry.text.slice(start, start + 150) + '…';
      link.append(title, excerpt); results.append(link);
    }
  } catch {
    if (current !== revision) return;
    indexPromise = undefined;
    const message = document.createElement('p');
    message.textContent = 'Search is unavailable. Browse the guides in the documentation menu.';
    results.append(message);
  }
}
searchInput?.addEventListener('input', searchDocs);
searchInput?.addEventListener('focus', () => {if (searchInput.value.trim().length >= 2) searchDocs();});
document.querySelector('.search')?.addEventListener('submit', event => {
  event.preventDefault(); results.querySelector('a')?.click();
});
document.addEventListener('keydown', event => {if (event.key === 'Escape') results.hidden = true;});
document.addEventListener('click', event => {if (!event.target.closest('.search')) results.hidden = true;});

for (const button of document.querySelectorAll('[data-copy-prompt], [data-copy-code]')) {
  button.addEventListener('click', async () => {
    const text = button.closest('.prompt-card, .code-block')?.querySelector('code')?.textContent;
    if (!text) return;
    const label = button.textContent;
    try {await navigator.clipboard.writeText(text); button.textContent = 'Copied';}
    catch {button.textContent = 'Select the text to copy';}
    setTimeout(() => {button.textContent = label;}, 1800);
  });
}
for (const video of document.querySelectorAll('video')) {
  video.addEventListener('play', () => {
    for (const other of document.querySelectorAll('video')) if (other !== video) other.pause();
  });
}
