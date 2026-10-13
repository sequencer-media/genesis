// Documentation estimates. Live admission and charges always use the server quote.
export function renderModelPricing(template, pricing) {
  if (!Number.isFinite(pricing.sequencerMarkupPercent) || pricing.sequencerMarkupPercent < 0) {
    throw new Error('Model pricing needs a nonnegative markup percentage.');
  }
  const rendered = template.replace(/\{\{price:([a-z0-9-]+):(provider|sequencer):(second|minute|hour|input|output)\}\}/g, (_, id, channel, unit) => {
    const tokenUnit = unit === 'input' || unit === 'output';
    const base = tokenUnit ? pricing.llms[id]?.[unit === 'input' ? 'providerUsdPerMillionInput' : 'providerUsdPerMillionOutput'] : pricing.worldstreams[id]?.providerUsdPerSecond;
    if (!Number.isFinite(base) || base <= 0) throw new Error('Missing model rate: ' + id);
    const seconds = tokenUnit ? 1 : {second:1, minute:60, hour:3600}[unit];
    const rate = base * seconds * (channel === 'sequencer' ? 1 + pricing.sequencerMarkupPercent / 100 : 1);
    const decimals = tokenUnit || unit === 'second' ? 6 : unit === 'minute' ? 4 : 2;
    return '$' + rate.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:decimals});
  });
  if (rendered.includes('{{price:')) throw new Error('Unknown model price placeholder.');
  return rendered;
}
