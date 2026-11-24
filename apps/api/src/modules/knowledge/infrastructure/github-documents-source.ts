import type { GitHubClient } from '../../github/infrastructure/github-client.js';
import type { DocumentsSource } from '../application/knowledge.js';
import { isDocument, summarizeDocument, type DocumentSummary } from '../domain/document.js';

/** Decision records and procedures read from repositories on GitHub. */
export class GitHubDocumentsSource implements DocumentsSource {
  constructor(
    private readonly github: GitHubClient,
    private readonly org: string,
  ) {}

  async documents(repository: string, folder: string): Promise<DocumentSummary[]> {
    const files = (await this.github.directory(this.org, repository, folder)).filter((f) => f.type === 'file' && isDocument(f.name));
    const summaries = await Promise.all(
      files.map(async (f) => summarizeDocument(f.name, (await this.github.file(this.org, repository, f.path)) ?? '', f.html_url)),
    );
    return summaries.sort((a, b) => a.file.localeCompare(b.file));
  }
}
