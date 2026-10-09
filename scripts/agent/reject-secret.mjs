import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function filesContainingSecret(secret, files) {
  if (!secret) throw new Error('Refusing to scan without a key value.');
  const hits = [];
  for (const file of files) {
    try {
      if (!statSync(file).isFile()) continue;
    } catch {
      continue;
    }
    const text = readFileSync(file);
    if (text.includes(Buffer.from(secret))) hits.push(file);
  }
  return hits;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const secret = process.env.CURSOR_API_KEY ?? '';
  const hits = filesContainingSecret(secret, process.argv.slice(2));
  if (hits.length) {
    console.error(`Secret material found in: ${hits.join(', ')}`);
    process.exit(1);
  }
  console.log('secret scan ok');
}
