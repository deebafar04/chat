import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Default repo list used when .gitmodules and .siterepos are unavailable.
 * These should match the `repo_name` values stored in Pinecone metadata.
 */
const DEFAULT_REPOS: string[] = [
  "data-commons",
  "open-footprint",
  "community-data",
  "requests",
  "useeio-widgets",
];

/**
 * Parse repository names from a .gitmodules file.
 * Extracts the submodule name from lines like: [submodule "repo-name"]
 * Returns the last path segment as the repo name.
 */
function parseGitmodules(content: string): string[] {
  const repos: string[] = [];
  const pattern = /\[submodule\s+"([^"]+)"\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1].trim();
    // Take the last path segment (e.g., "path/to/repo" → "repo")
    const name = raw.split("/").pop()?.trim();
    if (name) {
      repos.push(name);
    }
  }

  return repos;
}

/**
 * Parse repository names from a .siterepos file.
 * Assumes plain text format: one repo name per line.
 * Lines starting with # are treated as comments.
 */
function parseSiterepos(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Read a file from the project root, returning null if it doesn't exist.
 */
async function readProjectFile(filename: string): Promise<string | null> {
  try {
    const filePath = resolve(process.cwd(), filename);
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Get the list of available repositories for RAG filtering.
 *
 * Attempts to read repo names from:
 *   1. .gitmodules (git submodule config)
 *   2. .siterepos (plain text, one repo per line)
 *
 * Falls back to a hardcoded default list if neither file exists
 * or parsing yields zero results.
 */
export async function getAvailableRepos(): Promise<string[]> {
  const repos: string[] = [];

  // Try .gitmodules
  const gitmodulesContent = await readProjectFile(".gitmodules");
  if (gitmodulesContent) {
    repos.push(...parseGitmodules(gitmodulesContent));
  }

  // Try .siterepos
  const sitereposContent = await readProjectFile(".siterepos");
  if (sitereposContent) {
    repos.push(...parseSiterepos(sitereposContent));
  }

  // Deduplicate and sort
  const unique = [...new Set(repos)].sort();

  // Fall back to defaults if nothing was parsed
  if (unique.length === 0) {
    return DEFAULT_REPOS;
  }

  return unique;
}
