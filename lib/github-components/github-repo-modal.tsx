"use client";

import {
  Check,
  FileCode,
  Folder as FolderIcon,
  GitBranch,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GitHubFile, GitHubFolder, GitHubRepo } from "@/lib/types";
import { GitHubContextIntegration } from "./github-context-integration";
import { GitHubFileBrowser } from "./github-file-browser";

type GitHubRepoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  githubPAT: string;
  selectedRepos: GitHubRepo[];
  selectedFiles: GitHubFile[];
  selectedFolders: GitHubFolder[];
  onRepoSelectionChange: (repos: GitHubRepo[]) => void;
  onFileSelectionChange: (files: GitHubFile[]) => void;
  onFolderSelectionChange: (folders: GitHubFolder[]) => void;
};

export function GitHubRepoModal({
  isOpen,
  onClose,
  githubPAT,
  selectedRepos,
  selectedFiles,
  selectedFolders,
  onRepoSelectionChange,
  onFileSelectionChange,
  onFolderSelectionChange,
}: GitHubRepoModalProps) {
  const [tempSelectedRepos, setTempSelectedRepos] =
    useState<GitHubRepo[]>(selectedRepos);
  const [tempSelectedFiles, setTempSelectedFiles] =
    useState<GitHubFile[]>(selectedFiles);
  const [tempSelectedFolders, setTempSelectedFolders] =
    useState<GitHubFolder[]>(selectedFolders);
  const [activeTab, setActiveTab] = useState<string>("repos");

  if (!isOpen) {
    return null;
  }

  const handleApply = () => {
    onRepoSelectionChange(tempSelectedRepos);
    onFileSelectionChange(tempSelectedFiles);
    onFolderSelectionChange(tempSelectedFolders);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedRepos(selectedRepos);
    setTempSelectedFiles(selectedFiles);
    setTempSelectedFolders(selectedFolders);
    onClose();
  };

  const hasChanges =
    JSON.stringify(tempSelectedRepos.map((r) => r.id).sort()) !==
      JSON.stringify(selectedRepos.map((r) => r.id).sort()) ||
    JSON.stringify(tempSelectedFiles.map((f) => f.path).sort()) !==
      JSON.stringify(selectedFiles.map((f) => f.path).sort()) ||
    JSON.stringify(tempSelectedFolders.map((f) => f.path).sort()) !==
      JSON.stringify(selectedFolders.map((f) => f.path).sort());

  const selectedRepo =
    tempSelectedRepos.length > 0 ? tempSelectedRepos[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-border border-b bg-muted/30 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-xl">
                Resource Area Selection
              </h2>
              <p className="text-muted-foreground text-sm">
                Choose resource areas, files, and folders for conversation
                context.
              </p>
            </div>
          </div>
          <Button
            className="h-8 w-8 p-0 hover:bg-muted"
            onClick={handleCancel}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content with Tabs */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto">
          <Tabs
            className="w-full"
            onValueChange={setActiveTab}
            value={activeTab}
          >
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger className="flex items-center gap-2" value="repos">
                  <GitBranch className="h-4 w-4" />
                  Repositories
                  {tempSelectedRepos.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs">
                      {tempSelectedRepos.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  className="flex items-center gap-2"
                  disabled={!selectedRepo}
                  value="files"
                >
                  <FileCode className="h-4 w-4" />
                  Files & Folders
                  {(tempSelectedFiles.length > 0 ||
                    tempSelectedFolders.length > 0) && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs">
                      {tempSelectedFiles.length + tempSelectedFolders.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent className="p-6 pt-4" value="repos">
              <GitHubContextIntegration
                className=""
                githubPAT={githubPAT}
                onRepoSelectionChange={setTempSelectedRepos}
                selectedRepos={tempSelectedRepos}
              />
            </TabsContent>

            <TabsContent className="p-6 pt-4" value="files">
              {selectedRepo ? (
                <div>
                  <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3">
                    <p className="font-medium text-sm">
                      Browsing:{" "}
                      <span className="text-primary">
                        {selectedRepo.full_name}
                      </span>
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Select files and folders to include in your conversation
                      context
                    </p>
                  </div>
                  <GitHubFileBrowser
                    githubPAT={githubPAT}
                    onFileSelectionChange={setTempSelectedFiles}
                    onFolderSelectionChange={setTempSelectedFolders}
                    repo={selectedRepo}
                    selectedFiles={tempSelectedFiles}
                    selectedFolders={tempSelectedFolders}
                  />
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <FolderIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="mb-1 font-medium text-sm">
                    No repository selected
                  </p>
                  <p className="text-xs">
                    Please select a repository from the Repositories tab first
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-border border-t bg-muted/30 p-6">
          <div className="text-muted-foreground text-sm">
            {tempSelectedRepos.length > 0 && (
              <span className="mr-3">
                {tempSelectedRepos.length} repo
                {tempSelectedRepos.length !== 1 ? "s" : ""}
              </span>
            )}
            {tempSelectedFiles.length > 0 && (
              <span className="mr-3">
                {tempSelectedFiles.length} file
                {tempSelectedFiles.length !== 1 ? "s" : ""}
              </span>
            )}
            {tempSelectedFolders.length > 0 && (
              <span>
                {tempSelectedFolders.length} folder
                {tempSelectedFolders.length !== 1 ? "s" : ""}
              </span>
            )}
            {tempSelectedRepos.length === 0 &&
              tempSelectedFiles.length === 0 &&
              tempSelectedFolders.length === 0 && (
                <span>No items selected</span>
              )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="px-4"
              onClick={handleCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex items-center gap-2 px-6"
              disabled={!hasChanges && tempSelectedRepos.length === 0}
              onClick={handleApply}
              type="button"
            >
              <Check className="h-4 w-4" />
              Apply Selection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
