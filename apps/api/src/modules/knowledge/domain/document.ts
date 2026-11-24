/** A decision record or procedure, as listed by the portal. */
export type DocumentSummary = {
  file: string;
  title: string;
  status: string | null;
  url: string;
};

function plain(text: string): string {
  return text.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
}

/**
 * Title from the first level-1 heading (the file name otherwise) and status from a
 * `- **Status:** …` line, as written by the stack's ADR template.
 */
export function summarizeDocument(file: string, markdown: string, url: string): DocumentSummary {
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1];
  const status = /^[-*]\s+\*\*Status:\*\*\s*(.+)$/m.exec(markdown)?.[1];
  return { file, title: title ? plain(title) : file.replace(/\.md$/, ''), status: status ? plain(status) : null, url };
}

/** Markdown documents of a folder, excluding the index and templates. */
export function isDocument(name: string): boolean {
  return name.endsWith('.md') && !/^(readme|_template)\.md$/i.test(name);
}
