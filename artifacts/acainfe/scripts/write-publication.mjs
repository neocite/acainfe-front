import { writeFile } from 'node:fs/promises';
await writeFile(new URL('../dist/publication.json', import.meta.url), JSON.stringify({ publishedAt: new Date().toISOString() }));
