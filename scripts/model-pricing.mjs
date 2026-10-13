// Documentation estimates. Live admission and charges always use the server quote.
export function renderModelPricing(template, pricing) {
  const rendered = template.replace(/\{\{price:([a-z0-9-]+):(second|minute|hour|input|output)\}\}/g, (_, id, unit) => {
    const tokenUnit = unit === 'input' || unit === 'output';
    const base = tokenUnit ? pricing.llms[id]?.[unit === 'input' ? 'usdPerMillionInput' : 'usdPerMillionOutput'] : pricing.worldstreams[id]?.usdPerSecond;
    if (!Number.isFinite(base) || base <= 0) throw new Error('Missing model rate: ' + id);
    const seconds = tokenUnit ? 1 : {second:1, minute:60, hour:3600}[unit];
    const rate = base * seconds;
    const decimals = tokenUnit || unit === 'second' ? 6 : unit === 'minute' ? 4 : 2;
    return '$' + rate.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:decimals});
  });
  if (rendered.includes('{{price:')) throw new Error('Unknown model price placeholder.');
  return rendered;
}
