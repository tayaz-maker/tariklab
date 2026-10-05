import assert from 'node:assert/strict';

export const REQUIRED_WIDTHS = Object.freeze([1440, 390, 320]);

export function validateWidths(widths) {
  assert.ok(Array.isArray(widths), 'widths must be an array');
  assert.equal(widths.length, REQUIRED_WIDTHS.length, 'all three required widths must run');
  assert.ok(widths.every(width => Number.isInteger(width) && REQUIRED_WIDTHS.includes(width)),
    'only positive supported widths 1440, 390 and 320 are allowed');
  assert.equal(new Set(widths).size, REQUIRED_WIDTHS.length, 'widths must be unique');
  return [...widths];
}

export function recordActualOrigin(page, expectedOrigin, row, checkpoint) {
  const actualURL = page.url();
  const actualOrigin = new URL(actualURL).origin;
  const observation = { checkpoint, actualURL, actualOrigin, expectedOrigin };
  row.origins.push(observation);
  assert.equal(actualOrigin, expectedOrigin, `${checkpoint}: unexpected page origin`);
  return observation;
}

export function verifyCompletedCases(report) {
  assert.ok(Number.isInteger(report.expectedCaseCount) && report.expectedCaseCount > 0,
    'zero or invalid expected cases can never PASS');
  assert.equal(report.completedCaseCount, report.expectedCaseCount, 'all expected cases must complete');
  assert.equal(report.cases.length, report.expectedCaseCount, 'all expected cases must be recorded');
  assert.ok(report.cases.every(row => row.status === 'PASS'), 'every recorded case must PASS');
  assert.equal(new Set(report.cases.map(row => `${row.id}:${row.width}`)).size,
    report.expectedCaseCount, 'duplicate cases cannot satisfy coverage');
}
