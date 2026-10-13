export interface GenesisConfigField {
  type: 'string' | 'number' | 'boolean'; label: string; description?: string;
  default: string | number | boolean; min?: number; max?: number; maxLength?: number;
  options?: Array<{ value: string | number; label: string }>;
}
export function normalizeGenesisConfig(schema: unknown, values: unknown) {
  if (schema === undefined) schema = {};
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || Object.keys(schema).length > 32) throw new Error('Declare up to 32 project settings.');
  if (values !== undefined && (!values || typeof values !== 'object' || Array.isArray(values))) throw new Error('Provide project settings as an object.');
  const configSchema: Record<string, GenesisConfigField> = {}, config: Record<string, string | number | boolean> = {};
  for (const [id, raw] of Object.entries(schema)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Use safe project setting IDs.');
    const field = raw as GenesisConfigField;
    if (!field || !['string', 'number', 'boolean'].includes(field.type) || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 100 || typeof field.default !== field.type) throw new Error(`Declare a valid ${id} setting and default.`);
    if (field.description !== undefined && (typeof field.description !== 'string' || field.description.length > 240)) throw new Error('Keep setting descriptions under 240 characters.');
    if (field.min !== undefined && !Number.isFinite(field.min) || field.max !== undefined && !Number.isFinite(field.max) || field.min !== undefined && field.max !== undefined && field.min > field.max) throw new Error('Use finite ordered setting bounds.');
    if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > 4000)) throw new Error('Setting text limits range from 1 to 4,000 characters.');
    if (field.options !== undefined && (!Array.isArray(field.options) || !field.options.length || field.options.length > 24 || field.options.some(o => !o || typeof o.value !== field.type || typeof o.label !== 'string' || o.label.length > 100) || new Set(field.options.map(o => o.value)).size !== field.options.length)) throw new Error('Declare unique setting choices with matching types.');
    const check = (value: unknown) => typeof value === field.type && (field.type !== 'number' || Number.isFinite(value) && (field.min === undefined || Number(value) >= field.min) && (field.max === undefined || Number(value) <= field.max)) && (field.type !== 'string' || String(value).length <= (field.maxLength || 1200)) && (!field.options || field.options.some(o => o.value === value));
    const value = (values as any)?.[id] ?? field.default;
    if (!check(field.default) || !check(value)) throw new Error(`Choose a valid ${field.label}.`);
    configSchema[id] = JSON.parse(JSON.stringify(field)); config[id] = value as string | number | boolean;
  }
  if (values && Object.keys(values).some(id => !Object.hasOwn(configSchema, id))) throw new Error('Use declared project settings.');
  return { configSchema, config };
}
