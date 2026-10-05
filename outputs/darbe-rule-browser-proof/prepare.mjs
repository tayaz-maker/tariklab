import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { CASES, buildFixture, nodeCounterproof } from './fixtures.mjs';

const output = resolve(process.argv[2] || '/workspace/screenshots/darbe-rule-browser-preparation');
await mkdir(output, { recursive: true });
const cases = [];
for (const spec of CASES) {
  const fixture = buildFixture(spec);
  await writeFile(resolve(output, `${spec.id}.save.json`), fixture.raw + '\n');
  cases.push({ id: spec.id, name: fixture.name, materials: fixture.materialIds,
    cost: fixture.cost, boss: fixture.boss, target: fixture.target,
    bytes: Buffer.byteLength(fixture.raw), sha256: createHash('sha256').update(fixture.raw).digest('hex'),
    stages: nodeCounterproof(fixture) });
}
const result = { sourceBase: 'dfbab3f15b74df5336fecf9f7d4247184cbb9222',
  counterproofSource: 'a0bc478295a16d0a7120b7d200b0df61dc86af29',
  node: 'PASS', browser: 'NOT_RUN', B11: 'OPEN', cases };
await writeFile(resolve(output, 'preparation-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, cases: cases.length, node: 'PASS', browser: 'NOT_RUN', B11: 'OPEN' }));
