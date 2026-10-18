require('./register-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('report email preserves the failed URL and encodes notes as body text', () => {
  const { buildImportReportEmail } = require('../src/lib/import-report.ts');
  const href = buildImportReportEmail('reports@example.com', {
    source: 'https://example.com/recipe?a=1&b=2',
    message: 'Could not read this source.',
  }, 'Missing steps & ingredients\nBcc: nobody@example.com');
  const email = new URL(href);
  assert.equal(email.pathname, 'reports@example.com');
  assert.equal(email.searchParams.get('subject'), 'Omnicook: failed recipe link');
  assert.match(email.searchParams.get('body'), /https:\/\/example.com\/recipe\?a=1&b=2/);
  assert.match(email.searchParams.get('body'), /Could not read this source\./);
  assert.match(email.searchParams.get('body'), /Missing steps & ingredients\nBcc: nobody@example.com/);
  assert.equal(email.searchParams.has('bcc'), false);
});

test('only http links and a configured single email recipient can be reported', () => {
  const { buildImportReportEmail, failedLinkReport } = require('../src/lib/import-report.ts');
  assert.equal(failedLinkReport('recipe caption', 'Failed'), null);
  assert.equal(failedLinkReport('javascript:alert(1)', 'Failed'), null);
  assert.deepEqual(failedLinkReport(' https://example.com/recipe ', 'Failed'), {
    source: 'https://example.com/recipe', message: 'Failed',
  });
  for (const recipient of ['', 'a@example.com?bcc=b@example.com', 'a@example.com\r\nBcc:b@example.com']) {
    assert.equal(buildImportReportEmail(recipient, { source: 'https://example.com', message: 'Failed' }, ''), null);
  }
});
