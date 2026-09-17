const renderHosts = new Set([
  'render.worldofwarcraft.com',
  'render-us.worldofwarcraft.com',
  'render-eu.worldofwarcraft.com',
  'render-kr.worldofwarcraft.com',
  'render-tw.worldofwarcraft.com',
]);

export function isBlizzardPortrait(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      renderHosts.has(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/(?:us\/|eu\/|kr\/|tw\/)?character\/.+-avatar\.jpg$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
