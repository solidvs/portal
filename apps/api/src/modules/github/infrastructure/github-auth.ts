import { createPrivateKey, sign } from 'node:crypto';

/** Produces the Authorization header for GitHub's REST API. */
export interface GitHubAuth {
  authorization(): Promise<string>;
}

/** Local development: a personal token. */
export class TokenAuth implements GitHubAuth {
  constructor(private readonly token: string) {}

  async authorization(): Promise<string> {
    return `Bearer ${this.token}`;
  }
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * GitHub App installation: signs a short JWT with the App's private key, exchanges it for an
 * installation token (valid one hour) and reuses that token until five minutes before it expires.
 * The App's permissions are read-only, so the portal cannot change anything on GitHub.
 */
export class AppAuth implements GitHubAuth {
  private token: { value: string; expiresAt: number } | undefined;

  constructor(
    private readonly appId: string,
    private readonly privateKeyPem: string,
    private readonly installationId: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async authorization(): Promise<string> {
    if (!this.token || this.token.expiresAt - 5 * 60_000 <= this.now()) {
      this.token = await this.installationToken();
    }
    return `Bearer ${this.token.value}`;
  }

  private appJwt(): string {
    const issuedAt = Math.floor(this.now() / 1000) - 30;
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 9 * 60, iss: this.appId }));
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), createPrivateKey(this.privateKeyPem));
    return `${header}.${payload}.${base64url(signature)}`;
  }

  private async installationToken(): Promise<{ value: string; expiresAt: number }> {
    const response = await this.fetchImpl(`https://api.github.com/app/installations/${this.installationId}/access_tokens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.appJwt()}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    });
    if (!response.ok) throw new Error(`GitHub App token request failed: ${response.status}`);
    const body = (await response.json()) as { token: string; expires_at: string };
    return { value: body.token, expiresAt: Date.parse(body.expires_at) };
  }
}
