"use client";

import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GitHubFile, GitHubFolder, GitHubRepo } from "@/lib/types";

type GitHubFileBrowserProps = {
  repo: GitHubRepo;
  githubPAT: string;
  selectedFiles: GitHubFile[];
  selectedFolders: GitHubFolder[];
  onFileSelectionChange: (files: GitHubFile[]) => void;
  onFolderSelectionChange: (folders: GitHubFolder[]) => void;
  className?: string;
};

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  sha?: string;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: TreeNode[];
};

export function GitHubFileBrowser({
  repo,
  githubPAT,
  selectedFiles,
  selectedFolders,
  onFileSelectionChange,
  onFolderSelectionChange,
  className,
}: GitHubFileBrowserProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isLoadingRoot, setIsLoadingRoot] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const updateTreeNode = useCallback(
    (
      tree: TreeNode[],
      targetPath: string,
      newChildren: TreeNode[]
    ): TreeNode[] => {
      return tree.map((node) => {
        if (node.path === targetPath) {
          return {
            ...node,
            children: newChildren,
            isExpanded: true,
            isLoading: false,
          };
        }
        if (node.children && targetPath.startsWith(`${node.path}/`)) {
          return {
            ...node,
            children: updateTreeNode(node.children, targetPath, newChildren),
          };
        }
        return node;
      });
    },
    []
  );

  const loadDirectory = useCallback(
    async (path: string) => {
      if (!githubPAT) {
        toast.error("GitHub PAT is required");
        return;
      }

      const isRoot = path === "";
      if (isRoot) {
        setIsLoadingRoot(true);
      }

      try {
        const encodedPath = path ? encodeURIComponent(path) : "";
        const url = `https://api.github.com/repos/${repo.full_name}/contents/${encodedPath}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${githubPAT}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Directory not found");
          }
          if (response.status === 403) {
            throw new Error(
              "API rate limit exceeded or insufficient permissions"
            );
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Selected path is a file, not a directory");
        }

        const nodes: TreeNode[] = data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type === "dir" ? "dir" : "file",
          size: item.size,
          sha: item.sha,
          isExpanded: false,
          isLoading: false,
          children: item.type === "dir" ? [] : undefined,
        }));

        nodes.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === "dir" ? -1 : 1;
        });

        if (isRoot) {
          setTreeData(nodes);
          setError(null);
        } else {
          setTreeData((prevTree) => updateTreeNode(prevTree, path, nodes));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load directory";

        console.error("Failed to load GitHub directory:", errorMessage);

        if (isRoot) {
          setError(errorMessage);
        }
        toast.error(errorMessage);
      } finally {
        if (isRoot) {
          setIsLoadingRoot(false);
        }
      }
    },
    [repo, githubPAT, updateTreeNode]
  );

  useEffect(() => {
    if (repo && githubPAT) {
      loadDirectory("");
    }
  }, [repo, githubPAT, loadDirectory]);

  const toggleNodeExpansion = useCallback(
    (tree: TreeNode[], targetPath: string): TreeNode[] => {
      return tree.map((node) => {
        if (node.path === targetPath) {
          return {
            ...node,
            isExpanded: !node.isExpanded,
            isLoading: !!(node.children && node.children.length === 0),
          };
        }
        if (node.children && targetPath.startsWith(`${node.path}/`)) {
          return {
            ...node,
            children: toggleNodeExpansion(node.children, targetPath),
          };
        }
        return node;
      });
    },
    []
  );

  const findNode = useCallback(
    (tree: TreeNode[], targetPath: string): TreeNode | null => {
      for (const node of tree) {
        if (node.path === targetPath) {
          return node;
        }
        if (node.children && targetPath.startsWith(`${node.path}/`)) {
          const found = findNode(node.children, targetPath);
          if (found) {
            return found;
          }
        }
      }
      return null;
    },
    []
  );

  const toggleDirectory = useCallback(
    async (path: string) => {
      setTreeData((prevTree) => {
        const updatedTree = toggleNodeExpansion(prevTree, path);
        const node = findNode(updatedTree, path);
        if (
          node?.isExpanded &&
          (!node.children || node.children.length === 0)
        ) {
          loadDirectory(path);
        }
        return updatedTree;
      });
    },
    [loadDirectory, findNode, toggleNodeExpansion]
  );

  const handleFileToggle = useCallback(
    (file: TreeNode, isSelected: boolean) => {
      const githubFile: GitHubFile = {
        path: file.path,
        name: file.name,
        type: "file",
        size: file.size,
        sha: file.sha,
      };

      if (isSelected) {
        if (!selectedFiles.find((f) => f.path === file.path)) {
          onFileSelectionChange([...selectedFiles, githubFile]);
        }
      } else {
        onFileSelectionChange(
          selectedFiles.filter((f) => f.path !== file.path)
        );
      }
    },
    [selectedFiles, onFileSelectionChange]
  );

  const handleFolderToggle = useCallback(
    (folder: TreeNode, isSelected: boolean) => {
      const githubFolder: GitHubFolder = {
        path: folder.path,
        name: folder.name,
        type: "dir",
      };

      if (isSelected) {
        if (!selectedFolders.find((f) => f.path === folder.path)) {
          onFolderSelectionChange([...selectedFolders, githubFolder]);
        }
      } else {
        onFolderSelectionChange(
          selectedFolders.filter((f) => f.path !== folder.path)
        );
      }
    },
    [selectedFolders, onFolderSelectionChange]
  );

  const isFileSelected = useCallback(
    (path: string) => selectedFiles.some((f) => f.path === path),
    [selectedFiles]
  );

  const isFolderSelected = useCallback(
    (path: string) => selectedFolders.some((f) => f.path === path),
    [selectedFolders]
  );

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
      case "py":
      case "java":
      case "cpp":
      case "c":
      case "go":
      case "rs":
        return <FileCode className="h-4 w-4 text-blue-500" />;
      case "json":
      case "yaml":
      case "yml":
      case "toml":
        return <FileJson className="h-4 w-4 text-yellow-500" />;
      case "md":
      case "txt":
      case "doc":
      case "pdf":
        return <FileText className="h-4 w-4 text-gray-500" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "svg":
        return <ImageIcon className="h-4 w-4 text-purple-500" />;
      default:
        return <File className="h-4 w-4 text-gray-400" />;
    }
  };

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query.trim()) {
      return nodes;
    }

    const lowerQuery = query.toLowerCase();

    return nodes
      .filter((node) => {
        const nameMatches = node.name.toLowerCase().includes(lowerQuery);
        const pathMatches = node.path.toLowerCase().includes(lowerQuery);

        if (node.type === "dir" && node.children) {
          const filteredChildren = filterTree(node.children, query);
          if (filteredChildren.length > 0) {
            return true;
          }
        }

        return nameMatches || pathMatches;
      })
      .map((node) => {
        if (node.type === "dir" && node.children) {
          return {
            ...node,
            children: filterTree(node.children, query),
            isExpanded: query.trim() ? true : node.isExpanded,
          };
        }
        return node;
      });
  };

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isFile = node.type === "file";
    const isExpanded = node.isExpanded;
    const isSelected = isFile
      ? isFileSelected(node.path)
      : isFolderSelected(node.path);

    return (
      <div key={node.path}>
        <div
          className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {!isFile && (
            <button
              className="rounded p-0.5 hover:bg-muted"
              onClick={() => toggleDirectory(node.path)}
              type="button"
            >
              {node.isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}

          <Checkbox
            checked={isSelected}
            className="mt-0.5"
            onCheckedChange={(checked: boolean) => {
              if (isFile) {
                handleFileToggle(node, checked);
              } else {
                handleFolderToggle(node, checked);
              }
            }}
          />

          {isFile ? (
            getFileIcon(node.name)
          ) : isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-400" />
          ) : (
            <Folder className="h-4 w-4 text-blue-400" />
          )}

          <span className="flex-1 truncate text-sm">{node.name}</span>

          {isFile && node.size !== undefined && (
            <span className="text-muted-foreground text-xs">
              {formatBytes(node.size)}
            </span>
          )}
        </div>

        {!isFile && isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = filterTree(treeData, searchQuery);

  return (
    <div className={className}>
      <div className="relative mb-3">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
        <Input
          className="pr-10 pl-10"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files and folders..."
          value={searchQuery}
        />
        {searchQuery && (
          <Button
            className="-translate-y-1/2 absolute top-1/2 right-2 h-6 w-6 transform p-0"
            onClick={() => setSearchQuery("")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isLoadingRoot && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading repository files...</span>
        </div>
      )}

      {error && !isLoadingRoot && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-800 text-sm dark:text-red-200">{error}</p>
        </div>
      )}

      {!isLoadingRoot && !error && (
        <ScrollArea className="h-96 rounded-lg border bg-muted/20">
          <div className="p-2">
            {filteredTree.length > 0 ? (
              filteredTree.map((node) => renderTreeNode(node))
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="mb-1 font-medium text-sm">No files found</p>
                <p className="text-xs">Try a different search term</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {(selectedFiles.length > 0 || selectedFolders.length > 0) && (
        <div className="mt-3 text-muted-foreground text-xs">
          Selected: {selectedFiles.length} file
          {selectedFiles.length !== 1 ? "s" : ""}
          {selectedFolders.length > 0 &&
            `, ${selectedFolders.length} folder${selectedFolders.length !== 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 10) / 10} ${sizes[i]}`;
}
