import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ITEMS, ALL_MISSIONS, ASSETS, CONTRACTS, ESTATES, JOB_TIERS, KOSE_TIERS, NEIGHBORHOODS } from './data';
import { PL_ASSETS, PL_CONTRACTS, PL_CORNERS, PL_ESTATES, PL_HOODS, PL_ITEMS, PL_JOBS, PL_JOB_TIERS } from './cete-pl';

test('Polish catalog copy covers each current item, job, contract and starting neighborhood', () => {
  for (const item of ALL_ITEMS) { assert.ok(PL_ITEMS[item.id]?.name, item.id); assert.ok(PL_ITEMS[item.id]?.desc, item.id); }
  for (const job of ALL_MISSIONS) { assert.ok(PL_JOBS[job.id]?.name, job.id); assert.ok(PL_JOBS[job.id]?.desc, job.id); }
  for (const contract of CONTRACTS) assert.ok(PL_CONTRACTS[contract.id], contract.id);
  for (const tier of JOB_TIERS) assert.ok(PL_JOB_TIERS[tier.tier], String(tier.tier));
  for (const hood of NEIGHBORHOODS) { assert.ok(PL_HOODS[hood.id]?.blurb, hood.id); assert.ok(PL_HOODS[hood.id]?.perk, hood.id); }
  for (const estate of ESTATES) { assert.ok(PL_ESTATES[estate.id]?.name, estate.id); assert.ok(PL_ESTATES[estate.id]?.desc, estate.id); }
  for (const asset of ASSETS) { assert.ok(PL_ASSETS[asset.id]?.name, asset.id); assert.ok(PL_ASSETS[asset.id]?.hint, asset.id); }
  for (const corner of KOSE_TIERS) { assert.ok(PL_CORNERS[corner.lvl]?.name, String(corner.lvl)); assert.ok(PL_CORNERS[corner.lvl]?.desc, String(corner.lvl)); }
  assert.deepEqual(Object.keys(PL_ITEMS).sort(), ALL_ITEMS.map(x => x.id).sort());
  assert.deepEqual(Object.keys(PL_JOBS).sort(), ALL_MISSIONS.map(x => x.id).sort());
  assert.deepEqual(Object.keys(PL_CONTRACTS).sort(), CONTRACTS.map(x => x.id).sort());
});
