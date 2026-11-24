import type { GitHubAuth } from './github-auth.js';

export class GitHubNotFound extends Error {
  constructor(path: string) {
    super(`GitHub: not found ${path}`);
    this.name = 'GitHubNotFound';
  }
}

type CacheEntry = { expiresAt: number; value: Promise<unknown> };

/**
 * Read-only client of GitHub's REST API with an in-memory cache. Concurrent requests for the same
 * path share one call; failures are not cached.
 */
export class GitHubClient {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly auth: GitHubAuth,
    private readonly ttlMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  /** JSON answer of a GET, e.g. `/repos/<organization>/portal`. */
  json<T>(path: string): Promise<T> {
    return this.cached(`json:${path}`, () => this.request(path, 'application/vnd.github+json').then((r) => r.json() as Promise<T>));
  }

  /** Raw file content of a repository, or undefined when the file does not exist. */
  async file(owner: string, repo: string, path: string): Promise<string | undefined> {
    try {
      return await this.cached(`file:${owner}/${repo}/${path}`, () =>
        this.request(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`, 'application/vnd.github.raw+json').then((r) => r.text()),
      );
    } catch (error) {
      if (error instanceof GitHubNotFound) return undefined;
      throw error;
    }
  }

  /** Files of a directory, or an empty list when it does not exist. */
  async directory(owner: string, repo: string, path: string): Promise<{ name: string; path: string; type: string; html_url: string }[]> {
    try {
      return await this.json(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`);
    } catch (error) {
      if (error instanceof GitHubNotFound) return [];
      throw error;
    }
  }

  private async request(path: string, accept: string): Promise<Response> {
    const response = await this.fetchImpl(`https://api.github.com${path}`, {
      headers: { authorization: await this.auth.authorization(), accept, 'x-github-api-version': '2022-11-28' },
    });
    if (response.status === 404) throw new GitHubNotFound(path);
    if (!response.ok) throw new Error(`GitHub ${response.status} for ${path}`);
    return response;
  }

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = this.now();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
    const value = load();
    this.cache.set(key, { expiresAt: now + this.ttlMs, value });
    value.catch(() => this.cache.delete(key));
    return value;
  }
}
