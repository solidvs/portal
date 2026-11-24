import { createHash } from 'node:crypto';

import type { Response } from 'express';

/**
 * Strong ETag of a JSON body. Returns true when the client already has it: the controller then
 * answers 304 with no body, so systems can poll cheaply (ADR-0014, item 6).
 */
export function notModified(body: unknown, ifNoneMatch: string | undefined, response: Response): boolean {
  const etag = `"${createHash('sha256').update(JSON.stringify(body)).digest('base64url')}"`;
  response.setHeader('ETag', etag);
  if (ifNoneMatch?.split(',').some((candidate) => candidate.trim() === etag)) {
    response.status(304);
    return true;
  }
  return false;
}
