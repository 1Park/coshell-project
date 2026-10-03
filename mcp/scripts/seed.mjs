// Copies the repo's seed tickets (data/tickets) into DATA_DIR. Existing tickets are kept unless --force is passed.
// data/reset.json ({ "id": "...", "tickets": ["BUG-204"] }) wipes those tickets in DATA_DIR once per id,
// so a push can reset demo tickets on the Mac mini without shell access.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from '../src/store.mjs';

const force = process.argv.includes('--force');
const source = fileURLToPath(new URL('../../data/tickets/', import.meta.url));
const resetFile = fileURLToPath(new URL('../../data/reset.json', import.meta.url));
const target = join(DATA_DIR, 'tickets');
const lastResetFile = join(DATA_DIR, '.last-reset');
await mkdir(target, { recursive: true });

const reset = await readFile(resetFile, 'utf8').then(JSON.parse, () => null);
if (reset?.id && Array.isArray(reset.tickets)) {
  const lastId = await readFile(lastResetFile, 'utf8').then((s) => s.trim(), () => null);
  if (lastId !== reset.id) {
    for (const ticket of reset.tickets) {
      if (!/^[A-Za-z0-9_-]+$/.test(ticket)) continue;
      await rm(join(target, ticket), { recursive: true, force: true });
      console.log(`reset ${ticket} (${reset.id})`);
    }
    await writeFile(lastResetFile, reset.id + '\n');
  }
}

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
