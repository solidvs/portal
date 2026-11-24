import { describe, expect, it } from 'vitest';

import { isDocument, summarizeDocument } from './document.js';

describe('summarizeDocument', () => {
  it('reads the title and the status of an ADR', () => {
    const markdown = '# ADR-0009: Identity and access\n\n- **Status:** Accepted (owner approval, 2026-11-23)\n- **Date:** 2026-11-23\n';
    expect(summarizeDocument('0009-identity-and-access.md', markdown, 'u')).toEqual({
      file: '0009-identity-and-access.md',
      title: 'ADR-0009: Identity and access',
      status: 'Accepted (owner approval, 2026-11-23)',
      url: 'u',
    });
  });

  it('falls back to the file name and no status', () => {
    expect(summarizeDocument('deploy.md', 'Steps…', 'u')).toMatchObject({ title: 'deploy', status: null });
  });
});

describe('isDocument', () => {
  it('skips the index and the template', () => {
    expect(['README.md', '_template.md', '0001-x.md', 'notes.txt'].filter(isDocument)).toEqual(['0001-x.md']);
  });
});
