import { catalogResponse, type CatalogEntry } from '@portal/contracts';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from '../api';

const CatalogContext = createContext<CatalogEntry[] | null>(null);

/** The catalog, loaded once per page load and shared by the side nav and the pages. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  useEffect(() => {
    void api(catalogResponse, '/api/catalog').then((value) => setEntries(value.entries));
  }, []);
  return <CatalogContext.Provider value={entries}>{children}</CatalogContext.Provider>;
}

/** null while loading. */
export function useCatalog(): CatalogEntry[] | null {
  return useContext(CatalogContext);
}

const RECENT_KEY = 'recent-projects';

/** Recent projects are a per-browser convenience; storage may be unavailable. */
export function recentIds(): string[] {
  try {
    return (JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).slice(0, 5);
  } catch {
    return [];
  }
}

export function rememberProject(id: string): void {
  try {
    const ids = recentIds().filter((x) => x !== id);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...ids].slice(0, 5)));
  } catch {
    // Recent projects are optional.
  }
}

/** Loads one API resource for a page. */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let current = true;
    setValue(null);
    void load().then((result) => {
      if (current) setValue(result);
    });
    return () => {
      current = false;
    };
  }, deps);
  return value;
}
