export function raidProgressionEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .flatMap(([raid, progress]) => {
      if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return [];
      const summary = (progress as Record<string, unknown>).summary;
      return typeof summary === 'string' && summary.trim() ? [{ raid, summary }] : [];
    })
    .slice(0, 4);
}
