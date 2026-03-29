"use client";

import { GitBranch, GitFork, Globe, Lock, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type {
  GitHubContextState,
  GitHubRepo,
  GitHubSearchResponse,
} from "@/lib/types";

type GitHubContextIntegrationProps = {
  githubPAT?: string;
  selectedRepos: GitHubRepo[];
  onRepoSelectionChange: (repos: GitHubRepo[]) => void;
  className?: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function GitHubContextIntegration({
  githubPAT,
  selectedRepos,
  onRepoSelectionChange,
  className,
}: GitHubContextIntegrationProps) {
  const [state, setState] = useState<GitHubContextState>({
    searchQuery: "",
    searchResults: [],
    selectedRepos,
    isLoading: false,
    error: null,
  });

  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([]);
  const [loadingUserRepos, setLoadingUserRepos] = useState(false);

  const debouncedSearchQuery = useDebounce(state.searchQuery, 300);

  const fetchUserRepositories = useCallback(async () => {
    if (!githubPAT) {
      return;
    }

    setLoadingUserRepos(true);
    try {
      const response = await fetch(
        "https://api.github.com/user/repos?sort=updated&per_page=20&affiliation=owner",
        {
          headers: {
            Authorization: `token ${githubPAT}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch user repositories: ${response.status}`
        );
      }

      const repos: GitHubRepo[] = await response.json();
      setUserRepos(repos);
    } catch (error) {
      console.error("Failed to fetch GitHub user repositories:", error);
    } finally {
      setLoadingUserRepos(false);
    }
  }, [githubPAT]);

  const searchRepositories = useCallback(
    async (query: string) => {
      if (!githubPAT) {
        setState((prev) => ({
          ...prev,
          error:
            "GitHub Personal Access Token is required for repository search",
        }));
        return;
      }

      if (!query.trim()) {
        setState((prev) => ({
          ...prev,
          searchResults: [],
          error: null,
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=15`,
          {
            headers: {
              Authorization: `token ${githubPAT}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Invalid GitHub Personal Access Token");
          }
          if (response.status === 403) {
            throw new Error(
              "GitHub API rate limit exceeded. Please try again later."
            );
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data: GitHubSearchResponse = await response.json();

        setState((prev) => ({
          ...prev,
          searchResults: data.items,
          isLoading: false,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to search repositories";

        console.error("Failed to search GitHub repositories:", errorMessage);

        setState((prev) => ({
          ...prev,
          searchResults: [],
          isLoading: false,
          error: errorMessage,
        }));
        toast.error(errorMessage);
      }
    },
    [githubPAT]
  );

  useEffect(() => {
    if (githubPAT) {
      fetchUserRepositories();
    }
  }, [githubPAT, fetchUserRepositories]);

  useEffect(() => {
    searchRepositories(debouncedSearchQuery);
  }, [debouncedSearchQuery, searchRepositories]);

  const handleRepoToggle = useCallback(
    (repo: GitHubRepo, isSelected: boolean) => {
      let newSelectedRepos: GitHubRepo[];

      if (isSelected) {
        if (selectedRepos.find((r) => r.id === repo.id)) {
          newSelectedRepos = selectedRepos;
        } else {
          newSelectedRepos = [...selectedRepos, repo];
        }
      } else {
        newSelectedRepos = selectedRepos.filter((r) => r.id !== repo.id);
      }

      onRepoSelectionChange(newSelectedRepos);
    },
    [selectedRepos, onRepoSelectionChange]
  );

  const handleRemoveRepo = useCallback(
    (repoId: number) => {
      const newSelectedRepos = selectedRepos.filter((r) => r.id !== repoId);
      onRepoSelectionChange(newSelectedRepos);
    },
    [selectedRepos, onRepoSelectionChange]
  );

  const isRepoSelected = useCallback(
    (repoId: number) => {
      return selectedRepos.some((r) => r.id === repoId);
    },
    [selectedRepos]
  );

  const displayRepos = state.searchQuery.trim()
    ? state.searchResults
    : userRepos;
  const isShowingUserRepos = !state.searchQuery.trim();

  return (
    <div className={className}>
      {!githubPAT && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            GitHub Personal Access Token required for repository search. Please
            configure your PAT in settings.
          </p>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
        <Input
          className="pl-10"
          disabled={!githubPAT}
          onChange={(e) =>
            setState((prev) => ({ ...prev, searchQuery: e.target.value }))
          }
          placeholder="Search repositories or browse your own..."
          value={state.searchQuery}
        />
        {(state.isLoading || loadingUserRepos) && (
          <div className="-translate-y-1/2 absolute top-1/2 right-3 transform">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
        {state.searchQuery && (
          <Button
            className="-translate-y-1/2 absolute top-1/2 right-2 h-6 w-6 transform p-0"
            onClick={() => setState((prev) => ({ ...prev, searchQuery: "" }))}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {state.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-800 text-sm dark:text-red-200">
            {state.error}
          </p>
        </div>
      )}

      {selectedRepos.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium text-sm">
            <GitBranch className="h-4 w-4" />
            Selected Repositories ({selectedRepos.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedRepos.map((repo) => (
              <Badge
                className="flex items-center gap-2 py-1 pr-1"
                key={repo.id}
                variant="secondary"
              >
                <GitBranch className="h-3 w-3" />
                <span className="font-medium text-xs">{repo.full_name}</span>
                <Button
                  className="h-4 w-4 rounded-full p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveRepo(repo.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
          <Separator className="mt-3" />
        </div>
      )}

      {displayRepos.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 font-medium text-sm">
            <GitBranch className="h-4 w-4" />
            {isShowingUserRepos
              ? `Your Repositories (${displayRepos.length})`
              : `Search Results (${displayRepos.length})`}
          </h4>
          <ScrollArea className="h-80 rounded-lg border bg-muted/20">
            <div className="space-y-1 p-2">
              {displayRepos.map((repo) => (
                <div
                  className="flex items-start gap-3 rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-border hover:bg-background hover:shadow-sm"
                  key={repo.id}
                >
                  <Checkbox
                    checked={isRepoSelected(repo.id)}
                    className="mt-1"
                    onCheckedChange={(checked: boolean) =>
                      handleRepoToggle(repo, checked)
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <GitBranch className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-sm">
                        {repo.full_name}
                      </span>
                      <div className="flex items-center gap-1">
                        {repo.private ? (
                          <Lock className="h-3 w-3 text-amber-500" />
                        ) : (
                          <Globe className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                    </div>
                    {repo.description && (
                      <p className="mb-2 line-clamp-2 text-muted-foreground text-xs">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1">
                        <img
                          alt={repo.owner.login}
                          className="h-4 w-4 rounded-full"
                          src={repo.owner.avatar_url}
                        />
                        <span>{repo.owner.login}</span>
                      </div>
                      {(repo as any).stargazers_count > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          <span>{(repo as any).stargazers_count}</span>
                        </div>
                      )}
                      {(repo as any).forks_count > 0 && (
                        <div className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          <span>{(repo as any).forks_count}</span>
                        </div>
                      )}
                      {(repo as any).language && (
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                          <span>{(repo as any).language}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {isShowingUserRepos &&
        userRepos.length === 0 &&
        !loadingUserRepos &&
        githubPAT && (
          <div className="py-12 text-center text-muted-foreground">
            <GitBranch className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-1 font-medium text-sm">No repositories found</p>
            <p className="text-xs">
              Try searching for repositories or check your GitHub access.
            </p>
          </div>
        )}

      {state.searchQuery &&
        !state.isLoading &&
        state.searchResults.length === 0 &&
        !state.error && (
          <div className="py-12 text-center text-muted-foreground">
            <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-1 font-medium text-sm">No repositories found</p>
            <p className="text-xs">
              Try different search terms or browse your own repositories.
            </p>
          </div>
        )}

      {loadingUserRepos && isShowingUserRepos && (
        <div className="py-12 text-center text-muted-foreground">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm">Loading your repositories...</p>
        </div>
      )}
    </div>
  );
}
