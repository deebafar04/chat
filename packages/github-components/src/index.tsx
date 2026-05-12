/**
 * @shared/github-components — standalone Web Component bundle
 *
 * Wraps the React components from chat/lib/github-components/ as Custom
 * Elements so they can be used via a plain <script> tag in any HTML page
 * (e.g. requests/engine/index.html) without a React build pipeline.
 *
 * Registered elements:
 *   <resource-area-selector>  — repo filter dropdown
 *   <github-repo-modal>       — full repo/file/folder picker modal
 *
 * CSS is injected automatically by vite-plugin-css-injected-by-js.
 */

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import "./globals.css";

// Import directly from the canonical source in chat/ using the @/ alias.
// The @/ alias resolves to chat/ via vite.config.ts, and @/lib/utils is
// remapped to src/utils.ts to avoid pulling in chat's heavy deps.
import { ResourceAreaSelector } from "@/lib/github-components/resource-selector";
import { GitHubRepoModal } from "@/lib/github-components/github-repo-modal";
import type { GitHubRepo, GitHubFile, GitHubFolder } from "@/lib/types";

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Safely parse a JSON attribute; returns `fallback` on any error. */
function parseAttr<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ─── <resource-area-selector> ────────────────────────────────────────────────
//
// HTML attributes (all optional, JSON-encoded where needed):
//   available-repos  — JSON array of repo-name strings  (default: [])
//   selected-repos   — JSON array of repo-name strings  (default: [])
//   is-loading       — "true" | "false"                 (default: false)
//
// Dispatched events:
//   selection-change — CustomEvent<string[]>  fired whenever the selection changes
//
// Programmatic API (via JS):
//   el.availableRepos = ["repo-a", "repo-b"]
//   el.selectedRepos  = ["repo-a"]

class ResourceAreaSelectorElement extends HTMLElement {
  private _root: Root | null = null;
  private _availableRepos: string[] = [];
  private _selectedRepos: string[] = [];
  private _isLoading = false;

  static get observedAttributes() {
    return ["available-repos", "selected-repos", "is-loading"];
  }

  connectedCallback() {
    this._root = createRoot(this);
    this._render();
  }

  disconnectedCallback() {
    this._root?.unmount();
    this._root = null;
  }

  attributeChangedCallback(name: string, _old: string | null, next: string | null) {
    switch (name) {
      case "available-repos":
        this._availableRepos = parseAttr<string[]>(next, []);
        break;
      case "selected-repos":
        this._selectedRepos = parseAttr<string[]>(next, []);
        break;
      case "is-loading":
        this._isLoading = next === "true";
        break;
    }
    this._render();
  }

  // Programmatic setters so host JS can bypass JSON serialisation
  set availableRepos(v: string[]) {
    this._availableRepos = v;
    this._render();
  }
  set selectedRepos(v: string[]) {
    this._selectedRepos = v;
    this._render();
  }
  set isLoading(v: boolean) {
    this._isLoading = v;
    this._render();
  }

  private _handleChange = (repos: string[]) => {
    this._selectedRepos = repos;
    this.dispatchEvent(
      new CustomEvent<string[]>("selection-change", {
        detail: repos,
        bubbles: true,
        composed: true,
      })
    );
    this._render();
  };

  private _render() {
    if (!this._root) return;
    this._root.render(
      React.createElement(ResourceAreaSelector, {
        availableRepos: this._availableRepos.map((name) => ({ name, label: name })),
        ragSelectedRepos: this._selectedRepos,
        isLoading: this._isLoading,
        onRagSelectedReposChange: this._handleChange,
      })
    );
  }
}

// ─── <github-repo-modal> ─────────────────────────────────────────────────────
//
// HTML attributes:
//   is-open          — "true" | "false"      (default: false)
//   github-pat       — string                (default: "")
//   selected-repos   — JSON GitHubRepo[]     (default: [])
//   selected-files   — JSON GitHubFile[]     (default: [])
//   selected-folders — JSON GitHubFolder[]   (default: [])
//
// Dispatched events:
//   modal-close      — CustomEvent (no detail)
//   repos-change     — CustomEvent<GitHubRepo[]>
//   files-change     — CustomEvent<GitHubFile[]>
//   folders-change   — CustomEvent<GitHubFolder[]>
//
// Programmatic API:
//   el.open()   — opens the modal
//   el.close()  — closes the modal

class GitHubRepoModalElement extends HTMLElement {
  private _root: Root | null = null;
  private _isOpen = false;
  private _githubPAT = "";
  private _selectedRepos: GitHubRepo[] = [];
  private _selectedFiles: GitHubFile[] = [];
  private _selectedFolders: GitHubFolder[] = [];

  static get observedAttributes() {
    return [
      "is-open",
      "github-pat",
      "selected-repos",
      "selected-files",
      "selected-folders",
    ];
  }

  connectedCallback() {
    this._root = createRoot(this);
    this._render();
  }

  disconnectedCallback() {
    this._root?.unmount();
    this._root = null;
  }

  attributeChangedCallback(name: string, _old: string | null, next: string | null) {
    switch (name) {
      case "is-open":
        this._isOpen = next === "true";
        break;
      case "github-pat":
        this._githubPAT = next ?? "";
        break;
      case "selected-repos":
        this._selectedRepos = parseAttr<GitHubRepo[]>(next, []);
        break;
      case "selected-files":
        this._selectedFiles = parseAttr<GitHubFile[]>(next, []);
        break;
      case "selected-folders":
        this._selectedFolders = parseAttr<GitHubFolder[]>(next, []);
        break;
    }
    this._render();
  }

  /** Convenience methods callable from plain JS */
  open() {
    this._isOpen = true;
    this._render();
  }
  close() {
    this._isOpen = false;
    this._render();
  }

  private _handleClose = () => {
    this._isOpen = false;
    this.dispatchEvent(
      new CustomEvent("modal-close", { bubbles: true, composed: true })
    );
    this._render();
  };

  private _handleReposChange = (repos: GitHubRepo[]) => {
    this._selectedRepos = repos;
    this.dispatchEvent(
      new CustomEvent<GitHubRepo[]>("repos-change", {
        detail: repos,
        bubbles: true,
        composed: true,
      })
    );
  };

  private _handleFilesChange = (files: GitHubFile[]) => {
    this._selectedFiles = files;
    this.dispatchEvent(
      new CustomEvent<GitHubFile[]>("files-change", {
        detail: files,
        bubbles: true,
        composed: true,
      })
    );
  };

  private _handleFoldersChange = (folders: GitHubFolder[]) => {
    this._selectedFolders = folders;
    this.dispatchEvent(
      new CustomEvent<GitHubFolder[]>("folders-change", {
        detail: folders,
        bubbles: true,
        composed: true,
      })
    );
  };

  private _render() {
    if (!this._root) return;
    this._root.render(
      React.createElement(GitHubRepoModal, {
        isOpen: this._isOpen,
        githubPAT: this._githubPAT,
        selectedRepos: this._selectedRepos,
        selectedFiles: this._selectedFiles,
        selectedFolders: this._selectedFolders,
        onClose: this._handleClose,
        onRepoSelectionChange: this._handleReposChange,
        onFileSelectionChange: this._handleFilesChange,
        onFolderSelectionChange: this._handleFoldersChange,
      })
    );
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────
// Guard prevents "already defined" errors if the script is loaded twice.

if (!customElements.get("resource-area-selector")) {
  customElements.define("resource-area-selector", ResourceAreaSelectorElement);
}
if (!customElements.get("github-repo-modal")) {
  customElements.define("github-repo-modal", GitHubRepoModalElement);
}

// ─── Window export ────────────────────────────────────────────────────────────
// Exposes the element classes for advanced use (e.g. dynamically creating
// elements from JS without going through document.createElement).

declare global {
  interface Window {
    GitHubComponents: {
      ResourceAreaSelectorElement: typeof ResourceAreaSelectorElement;
      GitHubRepoModalElement: typeof GitHubRepoModalElement;
    };
  }
  interface HTMLElementTagNameMap {
    "resource-area-selector": ResourceAreaSelectorElement;
    "github-repo-modal": GitHubRepoModalElement;
  }
}

window.GitHubComponents = {
  ResourceAreaSelectorElement,
  GitHubRepoModalElement,
};
