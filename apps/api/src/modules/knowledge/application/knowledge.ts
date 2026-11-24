import type { DocumentSummary } from '../domain/document.js';

export type DocumentKind = 'decisions' | 'procedures';

/** What the knowledge views need (implemented over GitHub). */
export interface DocumentsSource {
  /** Documents of a folder of a repository, in file order. */
  documents(repository: string, folder: string): Promise<DocumentSummary[]>;
}

const FOLDERS: Record<DocumentKind, string> = { decisions: 'docs/decisions', procedures: 'docs/procedures' };

/** Use cases: decisions and procedures of a system; decisions of the standard stack. */
export class KnowledgeQueries {
  constructor(
    private readonly source: DocumentsSource,
    private readonly standardsRepository: string,
  ) {}

  ofSystem(repository: string, kind: DocumentKind): Promise<DocumentSummary[]> {
    return this.source.documents(repository, FOLDERS[kind]);
  }

  stackDecisions(): Promise<DocumentSummary[]> {
    return this.source.documents(this.standardsRepository, 'stack/decisions');
  }
}
