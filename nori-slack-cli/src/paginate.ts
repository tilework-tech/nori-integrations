const METADATA_KEYS = new Set(['ok', 'response_metadata', 'headers', 'warning']);

export async function mergePages(pages: AsyncIterable<Record<string, any>>): Promise<Record<string, any>> {
  const merged: Record<string, any> = {};
  const arrays: Record<string, any[]> = {};

  for await (const page of pages) {
    for (const [key, value] of Object.entries(page)) {
      if (METADATA_KEYS.has(key)) {
        merged[key] = value;
        continue;
      }
      if (Array.isArray(value)) {
        if (!arrays[key]) arrays[key] = [];
        arrays[key] = arrays[key].concat(value);
      } else {
        merged[key] = value;
      }
    }
  }

  return { ...merged, ...arrays };
}
