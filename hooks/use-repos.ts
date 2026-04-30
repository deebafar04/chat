"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Repo } from "@/lib/repos";

type UseReposResult = {
  repos: Repo[];
  isLoading: boolean;
  error: string | null;
};

const CACHE_KEY = "repos-cache";
const FETCH_TIMEOUT_MS = process.env.NODE_ENV === "production" ? 8000 : 60000;

function readCache(): Repo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Repo[]) : [];
  } catch {
    return [];
  }
}

function writeCache(repos: Repo[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(repos));
  } catch {}
}

// Module-level pageshow listener added once — survives React effect cleanup
// so it still fires even if React unmounted effects before bfcache froze the page.
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (e: PageTransitionEvent) => {
    // When the browser restores this page from the back-forward cache (bfcache),
    // React's event delegation is broken (synthetic events stop firing).
    // Force a full reload so React reinitialises cleanly.
    // The sessionStorage cache means repos appear immediately after the reload.
    if (e.persisted) window.location.reload();
  });
}

export function useRepos(): UseReposResult {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // true once we have data — prevents spinner on background refreshes
  const hasDataRef = useRef(false);

  const fetchRepos = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      if (!hasDataRef.current) setIsLoading(true);
      setError(null);
      const response = await fetch("/api/repos", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch repos: ${response.status}`);
      }
      const data = await response.json();
      const list: Repo[] = data.repos ?? [];
      setRepos(list);
      writeCache(list);
      hasDataRef.current = list.length > 0;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        console.warn("Repos fetch timed out");
      } else {
        const msg = err instanceof Error ? err.message : "Failed to fetch repos";
        console.error("Failed to fetch repos:", err);
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount: hydrate from cache immediately, then fetch fresh data.
  useEffect(() => {
    const cached = readCache();
    if (cached.length > 0) {
      setRepos(cached);
      setIsLoading(false);
      hasDataRef.current = true;
    }
    fetchRepos();
  // fetchRepos is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { repos, isLoading, error };
}
