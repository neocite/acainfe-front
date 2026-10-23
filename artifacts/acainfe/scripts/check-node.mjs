import { pathToFileURL } from 'node:url';

// https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
// Fail closed before Vite/tsx or the application can make network requests.
const minimums = new Map([[22, [23, 4]], [24, [22, 1]], [26, [12, 1]]]);

export function assertSecureNodeVersion(version = process.versions.node) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const [major, minor, patch] = match ? match.slice(1).map(Number) : [];
  const minimum = minimums.get(major);
  if (!minimum || minor < minimum[0] || (minor === minimum[0] && patch < minimum[1])) {
    throw new Error(`Node.js ${version} não atende à atualização de segurança de 21/10/2026. Use 22.23.4+, 24.22.1+ ou 26.12.1+ na respectiva linha suportada.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertSecureNodeVersion();
  console.info(`[runtime] Node.js ${process.version}; atualização de segurança de 21/10/2026 verificada.`);
}
