// Copies sample tickets into DATA_DIR. Existing tickets are kept unless --force is passed.
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from '../src/store.mjs';

const force = process.argv.includes('--force');
const source = fileURLToPath(new URL('../seed/tickets/', import.meta.url));
const target = join(DATA_DIR, 'tickets');
await mkdir(target, { recursive: true });

for (const ticket of await readdir(source)) {
  const dest = join(target, ticket);
  const exists = await stat(dest).then(() => true, () => false);
  if (exists && !force) {
    console.log(`skip ${ticket} (already exists, use --force to overwrite)`);
    continue;
  }
  await cp(join(source, ticket), dest, { recursive: true, force: true });
  console.log(`seeded ${ticket} -> ${dest}`);
}
