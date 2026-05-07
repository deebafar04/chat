(function () {
  "use strict";

  var STORAGE_KEYS = {
    apiKeys: "settings_api-keys",
    integrations: "settings_integrations",
    thinking: "thinking-mode",
    input: "input",
    demoChatId: "prompt-demo-chat-id"
  };

  function createPromptPort(target, options) {
    var container = typeof target === "string" ? document.querySelector(target) : target;
    if (!container) {
      throw new Error("Prompt mount target not found");
    }

    var widget = new StaticPromptWidget(container, options || {});
    widget.init();
    return widget;
  }

  function StaticPromptWidget(container, options) {
    this.container = container;
    this.options = normalizeOptions(options);
    this.chatId = this.options.chatId || getOrCreateChatId();
    this.state = {
      input: loadLocalString(STORAGE_KEYS.input, ""),
      status: "ready",
      attachments: [],
      uploadQueue: [],
      selectedModelId: this.options.defaultModel || "",
      thinkingMode: loadLocalBoolean(STORAGE_KEYS.thinking, false),
      modelCapabilities: null,
      dbStatus: null,
      serverKeys: [],
      serverOffline: false,
      selectedProviderId: "google",
      modelMenuOpen: false,
      contextOpen: false,
      usage: this.options.usage || null,
      githubModalOpen: false,
      githubToken: "",
      githubQuery: "",
      githubRepos: [],
      githubLoading: false,
      githubActiveRepo: null,
      githubPath: "",
      githubContents: [],
      selectedRepos: loadSessionJSON("github-repos-" + this.chatId, []),
      selectedFiles: loadSessionJSON("github-files-" + this.chatId, []),
      selectedFolders: loadSessionJSON("github-folders-" + this.chatId, []),
      statusText: "",
      statusKind: "",
      pendingSubmitPromise: null
    };
  }

  StaticPromptWidget.prototype.init = function () {
    this.renderShell();
    this.bindRootEvents();
    this.loadBootstrapData();
  };

  StaticPromptWidget.prototype.renderShell = function () {
    this.container.classList.add("sp-widget");
    this.container.innerHTML = [
      '<div class="sp-server-notice" data-role="server-notice" hidden></div>',
      '<form class="sp-prompt-form" novalidate>',
      '  <input class="sp-hidden-input" type="file" multiple>',
      '  <div class="sp-prompt-shell">',
      '    <div class="sp-attachments" data-role="attachments" hidden></div>',
      '    <div class="sp-row">',
      '      <textarea class="sp-textarea" rows="1" placeholder="Send a message..."></textarea>',
      '      <div class="sp-context-wrap"></div>',
      '    </div>',
      '    <div class="sp-github-context" data-role="github-context" hidden></div>',
      '    <div class="sp-toolbar">',
      '      <div class="sp-tools-left">',
      '        <button class="sp-icon-button" data-action="attachments" type="button" title="Add attachment"></button>',
      '        <button class="sp-icon-button" data-action="github" type="button" title="Select GitHub context"></button>',
      '        <div class="sp-model-wrap">',
      '          <button class="sp-model-trigger" data-action="toggle-model-menu" type="button"></button>',
      '          <div class="sp-model-menu" data-role="model-menu" hidden></div>',
      '        </div>',
      '        <div class="sp-toggle" data-role="thinking-wrap" hidden></div>',
      '      </div>',
      '      <button class="sp-send-button" data-role="submit" type="submit"></button>',
      '    </div>',
      "  </div>",
      '  <div class="sp-status" data-role="status"></div>',
      "</form>",
      '<div class="sp-modal-root" data-role="modal-root"></div>'
    ].join("");

    this.els = {
      serverNotice: this.container.querySelector('[data-role="server-notice"]'),
      form: this.container.querySelector(".sp-prompt-form"),
      fileInput: this.container.querySelector(".sp-hidden-input"),
      textarea: this.container.querySelector(".sp-textarea"),
      attachments: this.container.querySelector('[data-role="attachments"]'),
      githubContext: this.container.querySelector('[data-role="github-context"]'),
      contextWrap: this.container.querySelector(".sp-context-wrap"),
      attachmentsButton: this.container.querySelector('[data-action="attachments"]'),
      githubButton: this.container.querySelector('[data-action="github"]'),
      modelTrigger: this.container.querySelector('[data-action="toggle-model-menu"]'),
      modelMenu: this.container.querySelector('[data-role="model-menu"]'),
      thinkingWrap: this.container.querySelector('[data-role="thinking-wrap"]'),
      submit: this.container.querySelector('[data-role="submit"]'),
      status: this.container.querySelector('[data-role="status"]'),
      modalRoot: this.container.querySelector('[data-role="modal-root"]')
    };

    this.els.textarea.value = this.state.input;
    this.resizeTextarea();
    this.render();
  };

  StaticPromptWidget.prototype.bindRootEvents = function () {
    var self = this;

    this.els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (self.state.status === "submitted" || self.state.status === "streaming") {
        self.stopPendingSubmit();
        return;
      }
      self.submitPrompt();
    });

    this.els.textarea.addEventListener("input", function () {
      self.state.input = self.els.textarea.value;
      localStorage.setItem(STORAGE_KEYS.input, self.state.input);
      self.resizeTextarea();
      self.renderSubmitButton();
    });

    this.els.textarea.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        self.els.form.requestSubmit();
      }
    });

    this.els.fileInput.addEventListener("change", function (event) {
      self.handleFileInput(event);
    });

    this.container.addEventListener("click", function (event) {
      var actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;

      var action = actionEl.getAttribute("data-action");
      if (action === "attachments") {
        event.preventDefault();
        self.els.fileInput.click();
      } else if (action === "github") {
        event.preventDefault();
        self.openGitHubModal();
      } else if (action === "toggle-model-menu") {
        event.preventDefault();
        self.toggleModelMenu();
      } else if (action === "toggle-context") {
        event.preventDefault();
        self.state.contextOpen = !self.state.contextOpen;
        self.renderContextButton();
      }
    });

    document.addEventListener("click", function (event) {
      if (!self.container.contains(event.target)) {
        self.state.modelMenuOpen = false;
        self.state.contextOpen = false;
        self.renderModelMenu();
        self.renderContextButton();
      }
    });

    window.addEventListener("storage", function () {
      self.renderModelMenu();
    });
  };

  StaticPromptWidget.prototype.loadBootstrapData = async function () {
    await Promise.all([
      this.loadModelCapabilities(),
      this.loadServerKeys(),
      this.loadGitHubToken()
    ]);
    this.render();
  };

  StaticPromptWidget.prototype.loadModelCapabilities = async function () {
    try {
      var response = await fetch(this.buildUrl(this.options.modelCapabilitiesUrl), {
        credentials: "include"
      });
      var data = await response.json();
      this.state.modelCapabilities = data.capabilities || null;
      this.state.dbStatus = data.dbStatus || null;
      this.ensureSelectedModel();
    } catch (error) {
      if (error instanceof TypeError) {
        this.state.serverOffline = true;
      }
      var fallback = buildCapabilitiesFromProviders();
      if (fallback) {
        this.state.modelCapabilities = fallback;
        this.ensureSelectedModel();
      } else {
        this.setStatus("Model capabilities unavailable.", "error");
      }
    }
  };

  StaticPromptWidget.prototype.loadServerKeys = async function () {
    try {
      var response = await fetch(this.buildUrl(this.options.serverKeysUrl), {
        credentials: "include"
      });
      this.state.serverKeys = await response.json();
    } catch (error) {
      this.state.serverKeys = [];
    }
  };

  StaticPromptWidget.prototype.loadGitHubToken = async function () {
    var localToken = getGitHubTokenFromStorage();
    if (localToken) {
      this.state.githubToken = localToken;
      return;
    }
    try {
      var response = await fetch(this.buildUrl(this.options.githubTokenUrl), {
        credentials: "include"
      });
      var data = await response.json();
      this.state.githubToken = data && data.token ? data.token : "";
    } catch (error) {
      this.state.githubToken = "";
    }
  };

  StaticPromptWidget.prototype.buildUrl = function (path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return this.options.apiBase.replace(/\/$/, "") + path;
  };

  StaticPromptWidget.prototype.ensureSelectedModel = function () {
    var groups = getProviderGroups(this.state.modelCapabilities);
    if (!groups.length) return;

    var found = findSelectedModel(groups, this.state.selectedModelId);
    if (!found) {
      var first = findDefaultModel(groups);
      if (first) {
        this.state.selectedModelId = first.id;
      }
    }
    this.syncSelectedProvider();
  };

  StaticPromptWidget.prototype.syncSelectedProvider = function () {
    var groups = getProviderGroups(this.state.modelCapabilities);
    var found = findSelectedModel(groups, this.state.selectedModelId);
    if (found) {
      this.state.selectedProviderId = found.providerId;
    } else if (groups[0]) {
      this.state.selectedProviderId = groups[0].providerId;
    }
  };

  StaticPromptWidget.prototype.renderOfflineNotice = function () {
    var el = this.els.serverNotice;
    if (!el) return;
    if (!this.state.serverOffline) {
      el.hidden = true;
      return;
    }
    var base = this.options.apiBase || "localhost:8888";
    var host = base.replace(/^https?:\/\//, "").replace(/\/$/, "");
    el.hidden = false;
    el.innerHTML = svgAlertCircle(14) +
      "<span>Local server not running on <code>" + escapeHtml(host) + "</code> &mdash; using local model configuration.</span>";
  };

  StaticPromptWidget.prototype.render = function () {
    this.renderOfflineNotice();
    this.renderIcons();
    this.renderAttachments();
    this.renderGitHubContext();
    this.renderContextButton();
    this.renderModelTrigger();
    this.renderModelMenu();
    this.renderThinkingToggle();
    this.renderSubmitButton();
    this.renderStatus();
  };

  StaticPromptWidget.prototype.renderIcons = function () {
    this.els.attachmentsButton.innerHTML = svgPaperclip(14);
    this.els.githubButton.innerHTML = githubMark() + this.renderGitHubBadgeMarkup();
    this.els.attachmentsButton.hidden = !this.providerAllowsFiles();
  };

  StaticPromptWidget.prototype.renderGitHubBadgeMarkup = function () {
    var count = this.state.selectedRepos.length + this.state.selectedFiles.length + this.state.selectedFolders.length;
    return count ? '<span class="sp-icon-badge">' + count + "</span>" : "";
  };

  StaticPromptWidget.prototype.renderAttachments = function () {
    var items = this.state.attachments.concat(this.state.uploadQueue.map(function (name) {
      return { name: name, uploading: true, contentType: "", url: "" };
    }));

    this.els.attachments.hidden = items.length === 0;
    if (!items.length) {
      this.els.attachments.innerHTML = "";
      return;
    }

    var self = this;
    this.els.attachments.innerHTML = items.map(function (item, index) {
      var label = escapeHtml(item.name || "Untitled");
      var cls = item.uploading ? "sp-file-chip is-uploading" : "sp-file-chip";
      var remove = item.uploading
        ? ""
        : '<button class="sp-chip-remove" data-remove-attachment="' + index + '" title="Remove attachment">' + svgClose(10) + "</button>";
      return '<div class="' + cls + '"><span class="sp-chip-label">' + label + "</span>" + remove + "</div>";
    }).join("");

    this.els.attachments.querySelectorAll("[data-remove-attachment]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.getAttribute("data-remove-attachment"));
        self.removeAttachment(index);
      });
    });
  };

  StaticPromptWidget.prototype.renderGitHubContext = function () {
    var self = this;
    var count = this.state.selectedRepos.length + this.state.selectedFiles.length + this.state.selectedFolders.length;
    this.els.githubContext.hidden = count === 0;
    this.els.githubButton.classList.toggle("is-active", count > 0);
    this.els.githubButton.innerHTML = githubMark() + this.renderGitHubBadgeMarkup();

    if (!count) {
      this.els.githubContext.innerHTML = "";
      return;
    }

    var chips = [];
    this.state.selectedRepos.forEach(function (repo, index) {
      chips.push(chipMarkup("repo", repo.full_name, "repo-" + index));
    });
    this.state.selectedFiles.forEach(function (file, index) {
      chips.push(chipMarkup("file", file.name, "file-" + index));
    });
    this.state.selectedFolders.forEach(function (folder, index) {
      chips.push(chipMarkup("folder", folder.name, "folder-" + index));
    });

    this.els.githubContext.innerHTML = [
      '<div class="sp-github-context-title">',
      githubMarkSmall(),
      "<span>GitHub Context (" + count + ")</span>",
      "</div>",
      '<div class="sp-attachments">' + chips.join("") + "</div>"
    ].join("");

    this.els.githubContext.querySelectorAll("[data-remove-chip]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.removeGitHubChip(button.getAttribute("data-remove-chip"));
      });
    });
  };

  StaticPromptWidget.prototype.renderContextButton = function () {
    var usage = this.state.usage || {};
    var used = Number(usage.totalTokens || 0);
    var max = usage.context && (usage.context.totalMax || usage.context.combinedMax || usage.context.inputMax);
    var percent = max && max > 0 ? Math.min(100, (used / max) * 100) : 0;
    this.els.contextWrap.innerHTML = [
      '<div class="sp-model-wrap">',
      '  <button class="sp-context-button" data-action="toggle-context" type="button" title="Context usage">',
      contextRing(percent),
      "  </button>",
      '  <div class="sp-context-popover" data-role="context-popover"' + (this.state.contextOpen ? "" : " hidden") + ">",
      '    <div class="sp-card-body">',
      '      <div class="sp-card-title">' + percent.toFixed(1) + "%</div>",
      '      <div class="sp-card-subtitle">' + (max ? used + " / " + max + " tokens" : used + " tokens") + "</div>",
      "    </div>",
      "  </div>",
      "</div>"
    ].join("");
  };

  StaticPromptWidget.prototype.renderModelTrigger = function () {
    var groups = getProviderGroups(this.state.modelCapabilities);
    var found = findSelectedModel(groups, this.state.selectedModelId);
    if (!found) {
      this.els.modelTrigger.innerHTML = [
        svgCpu(16),
        '<span class="sp-model-copy"><span class="sp-model-name">Loading...</span><span class="sp-model-provider">Model</span></span>',
        svgChevronDown(16)
      ].join("");
      return;
    }
    this.els.modelTrigger.innerHTML = [
      svgCpu(16),
      '<span class="sp-model-copy"><span class="sp-model-name">' + escapeHtml(found.name) + '</span><span class="sp-model-provider">(' + escapeHtml(found.providerName) + ")</span></span>",
      svgChevronDown(16)
    ].join("");
  };

  StaticPromptWidget.prototype.renderModelMenu = function () {
    var self = this;
    var groups = getProviderGroups(this.state.modelCapabilities);
    this.els.modelMenu.hidden = !this.state.modelMenuOpen;
    if (!this.state.modelMenuOpen) return;

    if (!groups.length) {
      this.els.modelMenu.innerHTML = '<div class="sp-empty">No models available.</div>';
      return;
    }

    this.els.modelMenu.innerHTML = groups.map(function (group) {
      var hasBrowserKey = getConfiguredProviders().indexOf(group.providerId) >= 0;
      var hasServerKey = self.state.serverKeys.indexOf(group.providerId) >= 0;
      var isCli = isCliProvider(group.providerId);
      var hasKey = hasBrowserKey || hasServerKey || isCli;
      var providerRows = group.models.map(function (model) {
        var selected = model.id === self.state.selectedModelId;
        var meta = !hasKey ? "Add key to use" : (isCli ? "Available via local CLI" : (hasServerKey && !hasBrowserKey ? "Available via server .env" : model.description));
        return [
          '<button class="sp-model-option' + (hasKey ? "" : " is-disabled") + '" data-select-model="' + escapeAttr(model.id) + '" data-provider-id="' + escapeAttr(group.providerId) + '" type="button">',
          '  <div class="sp-model-option-row">',
          '    <div>',
          '      <div class="sp-model-option-title">' + escapeHtml(model.name) + (model.isDefault ? ' <span class="sp-model-provider">Default</span>' : "") + "</div>",
          '      <div class="sp-model-option-meta">' + escapeHtml(meta) + "</div>",
          "    </div>",
          '    <div>' + (selected && hasKey ? svgCheckCircle(14) : "") + "</div>",
          "  </div>",
          "</button>"
        ].join("");
      }).join("");

      return [
        '<div class="sp-model-provider-group">',
        '  <div class="sp-model-provider-header">',
        hasBrowserKey ? svgCheckCircle(13) : (isCli ? svgTerminal(13) : (hasServerKey ? svgServerKey(13) : svgLock(13))),
        '    <span>' + escapeHtml(group.providerName) + "</span>",
        '    <span>' + group.models.length + " model" + (group.models.length === 1 ? "" : "s") + "</span>",
        "  </div>",
        providerRows,
        "</div>"
      ].join("");
    }).join("");

    this.els.modelMenu.querySelectorAll("[data-select-model]").forEach(function (button) {
      button.addEventListener("click", function () {
        var modelId = button.getAttribute("data-select-model");
        var providerId = button.getAttribute("data-provider-id");
        self.selectModel(modelId, providerId);
      });
    });
  };

  StaticPromptWidget.prototype.renderThinkingToggle = function () {
    var supported = this.selectedModelSupportsThinking();
    this.els.thinkingWrap.hidden = !supported;
    if (!supported) {
      this.els.thinkingWrap.innerHTML = "";
      return;
    }
    this.els.thinkingWrap.innerHTML = [
      '<button class="sp-switch' + (this.state.thinkingMode ? " is-on" : "") + '" data-toggle-thinking type="button"><span class="sp-switch-thumb"></span></button>',
      '<span class="sp-toggle-label">Thinking</span>'
    ].join("");
    var self = this;
    this.els.thinkingWrap.querySelector("[data-toggle-thinking]").addEventListener("click", function () {
      self.state.thinkingMode = !self.state.thinkingMode;
      localStorage.setItem(STORAGE_KEYS.thinking, self.state.thinkingMode ? "true" : "false");
      self.renderThinkingToggle();
    });
  };

  StaticPromptWidget.prototype.renderSubmitButton = function () {
    var disabled = (!this.state.input.trim() && !this.state.attachments.length) || this.state.uploadQueue.length > 0;
    var isStop = this.state.status === "submitted" || this.state.status === "streaming";
    this.els.submit.disabled = disabled && !isStop;
    this.els.submit.classList.toggle("is-stop", isStop);
    this.els.submit.title = isStop ? "Stop" : "Send";
    this.els.submit.innerHTML = isStop ? svgStop(14) : svgArrowUp(14);
  };

  StaticPromptWidget.prototype.renderStatus = function () {
    this.els.status.textContent = this.state.statusText || "";
    this.els.status.className = "sp-status" + (this.state.statusKind ? " is-" + this.state.statusKind : "");
  };

  StaticPromptWidget.prototype.toggleModelMenu = function () {
    this.state.modelMenuOpen = !this.state.modelMenuOpen;
    this.state.contextOpen = false;
    this.renderModelMenu();
    this.renderContextButton();
  };

  StaticPromptWidget.prototype.selectModel = function (modelId, providerId) {
    var hasBrowserKey = getConfiguredProviders().indexOf(providerId) >= 0;
    var hasServerKey = this.state.serverKeys.indexOf(providerId) >= 0;
    if (!hasBrowserKey && !hasServerKey && !isCliProvider(providerId)) {
      if (this.options.onOpenSettings) {
        this.options.onOpenSettings(providerId, modelId);
      } else if (this.options.settingsUrl) {
        window.location.href = this.options.settingsUrl;
      }
      return;
    }
    this.state.selectedModelId = modelId;
    this.state.selectedProviderId = providerId;
    persistSelectedModel(modelId);
    this.state.modelMenuOpen = false;
    this.render();
  };

  StaticPromptWidget.prototype.providerAllowsFiles = function () {
    var providerId = this.state.selectedProviderId;
    var caps = this.state.modelCapabilities;
    if (!caps || !caps.providers || !caps.providers[providerId]) {
      return this.state.selectedModelId !== "chat-model-reasoning";
    }
    return !!(caps.providers[providerId].enabled && caps.providers[providerId].fileInputEnabled);
  };

  StaticPromptWidget.prototype.selectedModelSupportsThinking = function () {
    var groups = getProviderGroups(this.state.modelCapabilities);
    var found = findSelectedModel(groups, this.state.selectedModelId);
    return !!(found && found.supportsThinkingMode);
  };

  StaticPromptWidget.prototype.getAllowedFileTypes = function () {
    var caps = this.state.modelCapabilities;
    var providerId = this.state.selectedProviderId;
    if (!caps || !caps.providers || !caps.providers[providerId]) return [];
    return caps.providers[providerId].allowedFileTypes || [];
  };

  StaticPromptWidget.prototype.handleFileInput = async function (event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    if (!files.length) return;

    var filtered = this.filterAllowedFiles(files);
    if (!filtered.valid.length) {
      this.setStatus(filtered.error || "No valid files selected.", "error");
      this.els.fileInput.value = "";
      return;
    }

    if (filtered.invalid.length) {
      this.setStatus(filtered.error, "error");
    }

    var self = this;
    this.state.uploadQueue = filtered.valid.map(function (file) { return file.name; });
    this.renderAttachments();
    this.renderSubmitButton();

    try {
      for (var i = 0; i < filtered.valid.length; i++) {
        var uploaded = await this.uploadFile(filtered.valid[i]);
        if (uploaded) self.state.attachments.push(uploaded);
      }
      if (filtered.valid.length) this.setStatus("Attachment upload complete.", "ok");
    } finally {
      this.state.uploadQueue = [];
      this.els.fileInput.value = "";
      this.render();
    }
  };

  StaticPromptWidget.prototype.filterAllowedFiles = function (files) {
    var allowed = this.getAllowedFileTypes();
    if (!allowed.length) return { valid: files, invalid: [], error: "" };
    var valid = [];
    var invalid = [];

    files.forEach(function (file) {
      var extension = file.name.split(".").pop();
      extension = extension ? extension.toLowerCase() : "";
      var mime = (file.type || "").toLowerCase();
      var ok = allowed.some(function (rule) {
        var normalized = String(rule).toLowerCase();
        if (normalized === extension) return true;
        if (normalized.indexOf("/") >= 0) {
          if (normalized.slice(-2) === "/*") {
            return mime.indexOf(normalized.split("/")[0] + "/") === 0;
          }
          return mime === normalized;
        }
        return false;
      });
      (ok ? valid : invalid).push(file);
    });

    var error = invalid.length
      ? "Invalid file type(s): " + invalid.map(function (file) { return file.name; }).join(", ") + ". Allowed types: " + allowed.join(", ")
      : "";
    return { valid: valid, invalid: invalid, error: error };
  };

  StaticPromptWidget.prototype.uploadFile = async function (file) {
    var formData = new FormData();
    formData.append("file", file);
    formData.append("chatId", this.chatId);

    try {
      var response = await fetch(this.buildUrl(this.options.uploadUrl), {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      var data = await response.json();
      if (!response.ok) {
        this.setStatus(data.error || "Upload failed.", "error");
        return null;
      }
      return {
        name: data.name,
        url: data.url,
        contentType: data.contentType,
        storagePath: data.storagePath
      };
    } catch (error) {
      this.setStatus("Failed to upload file.", "error");
      return null;
    }
  };

  StaticPromptWidget.prototype.removeAttachment = async function (index) {
    var removed = this.state.attachments.splice(index, 1)[0];
    this.render();
    if (!removed || !removed.storagePath) return;

    try {
      await fetch(this.buildUrl(this.options.deleteUploadUrl), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: removed.storagePath,
          chatId: this.chatId
        })
      });
    } catch (error) {
      this.setStatus("Attachment removed locally, but server delete failed.", "error");
    }
  };

  StaticPromptWidget.prototype.openGitHubModal = async function () {
    this.state.githubModalOpen = true;
    this.renderGitHubModal();
    if (!this.state.githubRepos.length) {
      await this.searchGitHubRepos();
    }
  };

  StaticPromptWidget.prototype.closeGitHubModal = function () {
    this.state.githubModalOpen = false;
    this.els.modalRoot.innerHTML = "";
  };

  StaticPromptWidget.prototype.renderGitHubModal = function () {
    if (!this.state.githubModalOpen) {
      this.els.modalRoot.innerHTML = "";
      return;
    }

    var activeRepo = this.state.githubActiveRepo;
    var summary = [];
    if (this.state.selectedRepos.length) summary.push(this.state.selectedRepos.length + " repo" + plural(this.state.selectedRepos.length));
    if (this.state.selectedFiles.length) summary.push(this.state.selectedFiles.length + " file" + plural(this.state.selectedFiles.length));
    if (this.state.selectedFolders.length) summary.push(this.state.selectedFolders.length + " folder" + plural(this.state.selectedFolders.length));

    this.els.modalRoot.innerHTML = [
      '<div class="sp-modal-backdrop">',
      '  <div class="sp-modal">',
      '    <div class="sp-modal-header">',
      "      <div>",
      '        <h3 class="sp-modal-title">GitHub Context</h3>',
      '        <p class="sp-modal-subtitle">Select repositories, files, and folders to include with the prompt payload.</p>',
      "      </div>",
      '      <button class="sp-modal-close" data-gh-action="close" type="button" title="Close">' + svgClose(16) + "</button>",
      "    </div>",
      '    <div class="sp-modal-body">',
      '      <div class="sp-modal-grid">',
      '        <div class="sp-card">',
      '          <div class="sp-card-header"><h4 class="sp-card-title">Repositories</h4><p class="sp-card-subtitle">Use your saved GitHub PAT or the server token when available.</p></div>',
      '          <div class="sp-card-body">',
      '            <div class="sp-token-row">',
      '              <input class="sp-input" data-gh-field="token" placeholder="GitHub token (optional)" type="password" value="' + escapeAttr(this.state.githubToken) + '">',
      "            </div>",
      '            <div class="sp-search-row">',
      '              <input class="sp-input" data-gh-field="query" placeholder="Search repositories or leave blank to load your repos" type="text" value="' + escapeAttr(this.state.githubQuery) + '">',
      '              <div class="sp-search-actions">',
      '                <button class="sp-search-button" data-gh-action="search" type="button">Search</button>',
      '                <button class="sp-search-button secondary" data-gh-action="refresh" type="button">Refresh</button>',
      "              </div>",
      "            </div>",
      '            <div class="sp-list" data-role="repo-list">' + this.renderRepoList() + "</div>",
      "          </div>",
      "        </div>",
      '        <div class="sp-card">',
      '          <div class="sp-card-header"><h4 class="sp-card-title">Files &amp; Folders</h4><p class="sp-card-subtitle">' + (activeRepo ? "Browsing " + escapeHtml(activeRepo.full_name) : "Select a repository first.") + "</p></div>",
      '          <div class="sp-card-body">',
      this.renderGitHubBrowser(),
      "          </div>",
      "        </div>",
      "      </div>",
      "    </div>",
      '    <div class="sp-modal-footer">',
      '      <div class="sp-modal-summary">' + (summary.length ? summary.join(" · ") : "No GitHub items selected") + "</div>",
      '      <div class="sp-modal-actions">',
      '        <button class="sp-modal-button secondary" data-gh-action="clear" type="button">Clear</button>',
      '        <button class="sp-modal-button secondary" data-gh-action="close" type="button">Close</button>',
      '        <button class="sp-modal-button" data-gh-action="apply" type="button">Apply Selection</button>',
      "      </div>",
      "    </div>",
      "  </div>",
      "</div>"
    ].join("");

    this.bindGitHubModalEvents();
  };

  StaticPromptWidget.prototype.renderRepoList = function () {
    if (this.state.githubLoading) return '<div class="sp-empty">Loading repositories...</div>';
    if (!this.state.githubRepos.length) return '<div class="sp-empty">No repositories loaded yet.</div>';
    var self = this;
    return this.state.githubRepos.map(function (repo) {
      var selected = self.hasSelectedRepo(repo.id);
      var active = self.state.githubActiveRepo && self.state.githubActiveRepo.id === repo.id;
      return [
        '<button class="sp-list-item' + (active ? " is-active" : "") + '" data-gh-repo="' + repo.id + '" type="button">',
        '  <div class="sp-list-item-title">',
        selected ? svgCheckCircle(14) : githubMarkSmall(),
        "    <span>" + escapeHtml(repo.full_name) + "</span>",
        "  </div>",
        '  <div class="sp-list-item-meta">' + escapeHtml(repo.description || (repo.private ? "Private repository" : "Public repository")) + "</div>",
        "</button>"
      ].join("");
    }).join("");
  };

  StaticPromptWidget.prototype.renderGitHubBrowser = function () {
    var activeRepo = this.state.githubActiveRepo;
    if (!activeRepo) return '<div class="sp-empty">Select a repository to browse files and folders.</div>';
    return [
      '<div class="sp-browser-toolbar">',
      '  <div class="sp-breadcrumbs">' + this.renderBreadcrumbs() + "</div>",
      '  <button class="sp-inline-button" data-gh-action="up" type="button">Up</button>',
      '  <button class="sp-inline-button" data-gh-action="reload-contents" type="button">Reload</button>',
      "</div>",
      '<div class="sp-browser-list">' + this.renderContentRows() + "</div>"
    ].join("");
  };

  StaticPromptWidget.prototype.renderBreadcrumbs = function () {
    var path = this.state.githubPath || "";
    var parts = path ? path.split("/") : [];
    var html = ['<button class="sp-crumb" data-gh-path="" type="button">' + escapeHtml(this.state.githubActiveRepo.full_name) + "</button>"];
    var running = "";
    parts.forEach(function (part) {
      running = running ? running + "/" + part : part;
      html.push("<span>/</span>");
      html.push('<button class="sp-crumb" data-gh-path="' + escapeAttr(running) + '" type="button">' + escapeHtml(part) + "</button>");
    });
    return html.join("");
  };

  StaticPromptWidget.prototype.renderContentRows = function () {
    var self = this;
    if (!this.state.githubContents.length) {
      return '<div class="sp-empty">No files or folders loaded for this path.</div>';
    }
    return this.state.githubContents.map(function (item) {
      var isFile = item.type === "file";
      var selected = isFile ? self.hasSelectedFile(item.path) : self.hasSelectedFolder(item.path);
      return [
        '<div class="sp-browser-row">',
        '  <div class="sp-browser-row-main">',
        '    <div class="sp-browser-name">' + escapeHtml(item.name) + "</div>",
        '    <div class="sp-browser-path">' + escapeHtml(item.path) + "</div>",
        "  </div>",
        '  <div class="sp-browser-actions">',
        !isFile ? '<button class="sp-inline-button" data-gh-open="' + escapeAttr(item.path) + '" type="button">Open</button>' : "",
        '<button class="sp-inline-button' + (selected ? " is-primary" : "") + '" data-gh-select="' + escapeAttr(item.path) + '" data-gh-type="' + escapeAttr(item.type) + '" type="button">' + (selected ? "Selected" : "Select") + "</button>",
        "  </div>",
        "</div>"
      ].join("");
    }).join("");
  };

  StaticPromptWidget.prototype.bindGitHubModalEvents = function () {
    var self = this;
    this.els.modalRoot.querySelectorAll("[data-gh-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-gh-action");
        if (action === "close") {
          self.closeGitHubModal();
        } else if (action === "search" || action === "refresh") {
          self.state.githubQuery = self.els.modalRoot.querySelector('[data-gh-field="query"]').value.trim();
          self.state.githubToken = self.els.modalRoot.querySelector('[data-gh-field="token"]').value.trim();
          persistGitHubToken(self.state.githubToken);
          self.searchGitHubRepos();
        } else if (action === "reload-contents") {
          self.loadRepoContents(self.state.githubPath || "");
        } else if (action === "up") {
          self.goUpGitHubPath();
        } else if (action === "apply") {
          self.persistGitHubSelections();
          self.closeGitHubModal();
          self.renderGitHubContext();
        } else if (action === "clear") {
          self.clearGitHubSelections();
          self.renderGitHubModal();
        }
      });
    });

    this.els.modalRoot.querySelectorAll("[data-gh-repo]").forEach(function (button) {
      button.addEventListener("click", function () {
        var repoId = Number(button.getAttribute("data-gh-repo"));
        self.activateRepo(repoId);
      });
    });

    this.els.modalRoot.querySelectorAll("[data-gh-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.loadRepoContents(button.getAttribute("data-gh-open") || "");
      });
    });

    this.els.modalRoot.querySelectorAll("[data-gh-select]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.toggleGitHubSelection(button.getAttribute("data-gh-select"), button.getAttribute("data-gh-type"));
      });
    });

    this.els.modalRoot.querySelectorAll("[data-gh-path]").forEach(function (button) {
      button.addEventListener("click", function () {
        self.loadRepoContents(button.getAttribute("data-gh-path") || "");
      });
    });
  };

  StaticPromptWidget.prototype.searchGitHubRepos = async function () {
    this.state.githubLoading = true;
    this.renderGitHubModal();
    try {
      var repos = await fetchGitHubRepos(this.state.githubToken, this.state.githubQuery);
      this.state.githubRepos = repos;
      if (repos.length && !this.state.githubActiveRepo) {
        this.state.githubActiveRepo = repos[0];
        this.ensureRepoSelected(repos[0]);
        await this.loadRepoContents("");
      }
    } catch (error) {
      this.setStatus("GitHub repository lookup failed.", "error");
    } finally {
      this.state.githubLoading = false;
      this.renderGitHubModal();
    }
  };

  StaticPromptWidget.prototype.activateRepo = async function (repoId) {
    var repo = this.state.githubRepos.filter(function (item) { return item.id === repoId; })[0];
    if (!repo) return;
    this.state.githubActiveRepo = repo;
    this.ensureRepoSelected(repo);
    this.state.githubPath = "";
    await this.loadRepoContents("");
    this.renderGitHubModal();
  };

  StaticPromptWidget.prototype.loadRepoContents = async function (path) {
    if (!this.state.githubActiveRepo) return;
    try {
      this.state.githubPath = path || "";
      this.state.githubContents = await fetchGitHubContents(this.state.githubActiveRepo.full_name, this.state.githubPath, this.state.githubToken);
      this.renderGitHubModal();
    } catch (error) {
      this.setStatus("GitHub file browser failed to load.", "error");
    }
  };

  StaticPromptWidget.prototype.goUpGitHubPath = async function () {
    if (!this.state.githubPath) return;
    var parts = this.state.githubPath.split("/");
    parts.pop();
    await this.loadRepoContents(parts.join("/"));
  };

  StaticPromptWidget.prototype.ensureRepoSelected = function (repo) {
    if (!this.hasSelectedRepo(repo.id)) {
      this.state.selectedRepos = [repo].concat(this.state.selectedRepos);
    }
  };

  StaticPromptWidget.prototype.hasSelectedRepo = function (repoId) {
    return this.state.selectedRepos.some(function (repo) { return repo.id === repoId; });
  };

  StaticPromptWidget.prototype.hasSelectedFile = function (path) {
    return this.state.selectedFiles.some(function (file) { return file.path === path; });
  };

  StaticPromptWidget.prototype.hasSelectedFolder = function (path) {
    return this.state.selectedFolders.some(function (folder) { return folder.path === path; });
  };

  StaticPromptWidget.prototype.toggleGitHubSelection = function (path, type) {
    var item = this.state.githubContents.filter(function (entry) { return entry.path === path; })[0];
    if (!item) return;

    if (type === "file") {
      if (this.hasSelectedFile(path)) {
        this.state.selectedFiles = this.state.selectedFiles.filter(function (file) { return file.path !== path; });
      } else {
        this.state.selectedFiles.push({
          path: item.path,
          name: item.name,
          type: "file",
          size: item.size,
          sha: item.sha,
          url: item.html_url || item.url
        });
      }
    } else {
      if (this.hasSelectedFolder(path)) {
        this.state.selectedFolders = this.state.selectedFolders.filter(function (folder) { return folder.path !== path; });
      } else {
        this.state.selectedFolders.push({
          path: item.path,
          name: item.name,
          type: "dir",
          url: item.html_url || item.url
        });
      }
    }
    this.renderGitHubModal();
  };

  StaticPromptWidget.prototype.clearGitHubSelections = function () {
    this.state.selectedRepos = [];
    this.state.selectedFiles = [];
    this.state.selectedFolders = [];
    this.persistGitHubSelections();
    this.renderGitHubContext();
  };

  StaticPromptWidget.prototype.persistGitHubSelections = function () {
    sessionStorage.setItem("github-repos-" + this.chatId, JSON.stringify(this.state.selectedRepos));
    sessionStorage.setItem("github-files-" + this.chatId, JSON.stringify(this.state.selectedFiles));
    sessionStorage.setItem("github-folders-" + this.chatId, JSON.stringify(this.state.selectedFolders));
  };

  StaticPromptWidget.prototype.removeGitHubChip = function (key) {
    if (key.indexOf("repo-") === 0) {
      var repoIndex = Number(key.replace("repo-", ""));
      this.state.selectedRepos.splice(repoIndex, 1);
    } else if (key.indexOf("file-") === 0) {
      var fileIndex = Number(key.replace("file-", ""));
      this.state.selectedFiles.splice(fileIndex, 1);
    } else if (key.indexOf("folder-") === 0) {
      var folderIndex = Number(key.replace("folder-", ""));
      this.state.selectedFolders.splice(folderIndex, 1);
    }
    this.persistGitHubSelections();
    this.renderGitHubContext();
  };

  StaticPromptWidget.prototype.submitPrompt = function () {
    if (!this.state.input.trim() && !this.state.attachments.length) return;

    var payload = this.buildPromptPayload();
    var handler = this.options.onSubmit;
    var result;

    this.state.status = "ready";
    this.setStatus("", "");

    if (typeof handler === "function") {
      try {
        result = handler(payload, this);
      } catch (error) {
        this.setStatus(error && error.message ? error.message : "Submit failed.", "error");
        return;
      }
    } else {
      this.container.dispatchEvent(new CustomEvent("prompt-submit", {
        bubbles: true,
        detail: payload
      }));
    }

    if (result && typeof result.then === "function") {
      this.state.status = "submitted";
      this.state.pendingSubmitPromise = result;
      this.renderSubmitButton();
      var self = this;
      result.then(function () {
        if (self.state.pendingSubmitPromise === result) {
          self.finishSubmit(true);
        }
      }).catch(function (error) {
        if (self.state.pendingSubmitPromise === result) {
          self.finishSubmit(false, error && error.message ? error.message : "Submit failed.");
        }
      });
    } else {
      this.finishSubmit(true);
    }
  };

  StaticPromptWidget.prototype.finishSubmit = function (ok, errorMessage) {
    this.state.pendingSubmitPromise = null;
    this.state.status = "ready";
    if (ok) {
      this.state.input = "";
      this.state.attachments = [];
      this.els.textarea.value = "";
      localStorage.setItem(STORAGE_KEYS.input, "");
      this.persistGitHubSelections();
      this.setStatus("Prompt emitted.", "ok");
    } else {
      this.setStatus(errorMessage || "Submit failed.", "error");
    }
    this.resizeTextarea();
    this.render();
  };

  StaticPromptWidget.prototype.stopPendingSubmit = function () {
    if (typeof this.options.onStop === "function") {
      this.options.onStop(this);
    }
    this.state.pendingSubmitPromise = null;
    this.state.status = "ready";
    this.setStatus("Stopped.", "ok");
    this.renderSubmitButton();
  };

  StaticPromptWidget.prototype.buildPromptPayload = function () {
    var parts = this.state.attachments.map(function (attachment) {
      return {
        type: "file",
        url: attachment.url,
        name: attachment.name,
        mediaType: attachment.contentType
      };
    });

    var text = this.state.input;
    if (this.state.selectedRepos.length || this.state.selectedFiles.length || this.state.selectedFolders.length) {
      var lines = [];
      if (this.state.selectedRepos.length) {
        lines.push("GitHub Repositories: " + this.state.selectedRepos.map(function (repo) { return repo.full_name; }).join(", "));
      }
      if (this.state.selectedFiles.length) {
        lines.push("Files: " + this.state.selectedFiles.map(function (file) { return file.path; }).join(", "));
      }
      if (this.state.selectedFolders.length) {
        lines.push("Folders: " + this.state.selectedFolders.map(function (folder) { return folder.path; }).join(", "));
      }
      text = lines.join("\n") + "\n\nQuery: " + text;
    }

    parts.push({ type: "text", text: text });

    var payload = {
      role: "user",
      parts: parts
    };

    var metadata = {};
    if (this.selectedModelSupportsThinking() && this.state.thinkingMode) {
      metadata.thinking = true;
    }
    if (this.state.selectedRepos.length || this.state.selectedFiles.length || this.state.selectedFolders.length) {
      metadata.github = {
        repos: this.state.selectedRepos.slice(),
        files: this.state.selectedFiles.slice(),
        folders: this.state.selectedFolders.slice()
      };
    }
    if (Object.keys(metadata).length) {
      payload.experimental_providerMetadata = metadata;
    }

    return payload;
  };

  StaticPromptWidget.prototype.resizeTextarea = function () {
    this.els.textarea.style.height = "44px";
    this.els.textarea.style.height = Math.min(200, this.els.textarea.scrollHeight) + "px";
  };

  StaticPromptWidget.prototype.setStatus = function (message, kind) {
    this.state.statusText = message || "";
    this.state.statusKind = kind || "";
    this.renderStatus();
  };

  StaticPromptWidget.prototype.setUsage = function (usage) {
    this.state.usage = usage || null;
    this.renderContextButton();
  };

  function normalizeOptions(options) {
    return {
      apiBase: options.apiBase || "",
      chatId: options.chatId || "",
      defaultModel: options.defaultModel || readSelectedModel(),
      modelCapabilitiesUrl: options.modelCapabilitiesUrl || "/api/models/capabilities",
      serverKeysUrl: options.serverKeysUrl || "/api/server-keys",
      githubTokenUrl: options.githubTokenUrl || "/api/github-token",
      uploadUrl: options.uploadUrl || "/api/files/upload",
      deleteUploadUrl: options.deleteUploadUrl || "/api/files/delete",
      settingsUrl: options.settingsUrl || "../key/",
      usage: options.usage || null,
      onSubmit: options.onSubmit || null,
      onStop: options.onStop || null,
      onOpenSettings: options.onOpenSettings || null
    };
  }

  function getProviderGroups(capabilities) {
    if (!capabilities || !capabilities.providers) return [];
    var groups = [];
    Object.keys(capabilities.providers).forEach(function (providerId) {
      var provider = capabilities.providers[providerId];
      var models = Object.keys(provider.models || {}).map(function (modelId) {
        var model = provider.models[modelId];
        return {
          id: modelId,
          name: model.name,
          description: model.description,
          isDefault: !!model.isDefault,
          supportsThinkingMode: !!model.supportsThinkingMode
        };
      }).sort(function (a, b) {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });
      groups.push({
        providerId: providerId,
        providerName: getProviderName(providerId),
        models: models
      });
    });
    return groups.sort(function (a, b) { return a.providerName.localeCompare(b.providerName); });
  }

  function findSelectedModel(groups, selectedModelId) {
    var found = null;
    groups.some(function (group) {
      return group.models.some(function (model) {
        if (model.id === selectedModelId || model.id.indexOf(selectedModelId) >= 0 || selectedModelId.indexOf(model.id) >= 0) {
          found = {
            id: model.id,
            name: model.name,
            providerId: group.providerId,
            providerName: group.providerName,
            description: model.description,
            supportsThinkingMode: model.supportsThinkingMode
          };
          return true;
        }
        return false;
      });
    });
    return found;
  }

  function findDefaultModel(groups) {
    var model = null;
    groups.some(function (group) {
      model = group.models.filter(function (item) { return item.isDefault; })[0] || group.models[0];
      if (model) {
        model.providerId = group.providerId;
        return true;
      }
      return false;
    });
    return model;
  }

  function getConfiguredProviders() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.apiKeys) || "{}");
      return Object.keys(raw).filter(function (key) { return !!raw[key]; });
    } catch (error) {
      return [];
    }
  }

  function getGitHubTokenFromStorage() {
    try {
      var apiKeys = JSON.parse(localStorage.getItem(STORAGE_KEYS.apiKeys) || "{}");
      if (apiKeys.github && String(apiKeys.github).indexOf("rsa:") !== 0 && String(apiKeys.github).indexOf(":") < 0) {
        return apiKeys.github;
      }
      var integrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.integrations) || "{}");
      return integrations.github && integrations.github.token ? integrations.github.token : "";
    } catch (error) {
      return "";
    }
  }

  function persistGitHubToken(token) {
    if (!token) return;
    try {
      var integrations = JSON.parse(localStorage.getItem(STORAGE_KEYS.integrations) || "{}");
      if (!integrations.github) integrations.github = {};
      integrations.github.token = token;
      localStorage.setItem(STORAGE_KEYS.integrations, JSON.stringify(integrations));
    } catch (error) {}
  }

  async function fetchGitHubRepos(token, query) {
    var headers = {
      Accept: "application/vnd.github+json"
    };
    if (token) headers.Authorization = "Bearer " + token;

    if (query) {
      var searchUrl = "https://api.github.com/search/repositories?q=" + encodeURIComponent(query) + "&per_page=20&sort=updated";
      var searchResponse = await fetch(searchUrl, { headers: headers });
      var searchData = await searchResponse.json();
      return Array.isArray(searchData.items) ? searchData.items : [];
    }

    var reposUrl = token
      ? "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
      : "https://api.github.com/search/repositories?q=codechat&per_page=12&sort=updated";
    var response = await fetch(reposUrl, { headers: headers });
    var data = await response.json();
    return Array.isArray(data) ? data : (data.items || []);
  }

  async function fetchGitHubContents(fullName, path, token) {
    var headers = {
      Accept: "application/vnd.github+json"
    };
    if (token) headers.Authorization = "Bearer " + token;
    var url = "https://api.github.com/repos/" + fullName + "/contents/" + (path ? encodeURIComponent(path).replace(/%2F/g, "/") : "");
    var response = await fetch(url, { headers: headers });
    var data = await response.json();
    if (!Array.isArray(data)) return [];
    return data;
  }

  function loadLocalString(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function loadLocalBoolean(key, fallback) {
    return loadLocalString(key, fallback ? "true" : "false") === "true";
  }

  function loadSessionJSON(key, fallback) {
    try {
      var value = sessionStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function persistSelectedModel(modelId) {
    try {
      localStorage.setItem("prompt-selected-model", modelId);
      document.cookie = "chat-model=" + encodeURIComponent(modelId) + "; path=/";
    } catch (error) {}
  }

  function readSelectedModel() {
    try {
      return localStorage.getItem("prompt-selected-model") || "";
    } catch (error) {
      return "";
    }
  }

  function getOrCreateChatId() {
    try {
      var existing = sessionStorage.getItem(STORAGE_KEYS.demoChatId);
      if (existing) return existing;
      var next = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : fallbackUuid();
      sessionStorage.setItem(STORAGE_KEYS.demoChatId, next);
      return next;
    } catch (error) {
      return fallbackUuid();
    }
  }

  function fallbackUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      var rand = Math.random() * 16 | 0;
      var value = char === "x" ? rand : (rand & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function chipMarkup(type, label, key) {
    return '<div class="sp-gh-chip ' + type + '"><span class="sp-chip-label">' + escapeHtml(label) + '</span><button class="sp-chip-remove" data-remove-chip="' + escapeAttr(key) + '" title="Remove">' + svgClose(10) + "</button></div>";
  }

  function plural(count) {
    return count === 1 ? "" : "s";
  }

  function contextRing(percent) {
    var radius = 10;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference * (1 - percent / 100);
    return [
      '<svg class="sp-context-ring" aria-label="' + escapeAttr(percent.toFixed(2)) + '% of model context used" height="28" viewBox="0 0 24 24" width="28">',
      '  <circle cx="12" cy="12" r="10" fill="none" opacity="0.25" stroke="currentColor" stroke-width="2"></circle>',
      '  <circle cx="12" cy="12" r="10" fill="none" opacity="0.7" stroke="currentColor" stroke-dasharray="' + circumference + " " + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" stroke-width="2" transform="rotate(-90 12 12)"></circle>',
      '  <rect x="8.5" y="14.5" width="2" height="3" fill="currentColor" opacity="0.55" rx="0.4"></rect>',
      '  <rect x="11" y="11.5" width="2" height="6" fill="currentColor" opacity="0.55" rx="0.4"></rect>',
      '  <rect x="13.5" y="13" width="2" height="4.5" fill="currentColor" opacity="0.55" rx="0.4"></rect>',
      "</svg>"
    ].join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function svgArrowUp(size) {
    return '<svg height="' + size + '" viewBox="0 0 16 16" width="' + size + '"><path d="M8.70711 1.39644C8.31659 1.00592 7.68342 1.00592 7.2929 1.39644L2.21968 6.46966L1.68935 6.99999L2.75001 8.06065L3.28034 7.53032L7.25001 3.56065V15H8.75001V3.56065L12.7197 7.53032L13.25 8.06065L14.3107 6.99999L13.7803 6.46966L8.70711 1.39644Z" fill="currentColor"></path></svg>';
  }

  function svgStop(size) {
    return '<svg height="' + size + '" viewBox="0 0 16 16" width="' + size + '"><path d="M3 3H13V13H3V3Z" fill="currentColor"></path></svg>';
  }

  function svgPaperclip(size) {
    return '<svg height="' + size + '" viewBox="0 0 16 16" width="' + size + '" style="transform:rotate(-45deg)"><path d="M10.8591 1.70735C10.3257 1.70735 9.81417 1.91925 9.437 2.29643L3.19455 8.53886C2.56246 9.17095 2.20735 10.0282 2.20735 10.9222C2.20735 11.8161 2.56246 12.6734 3.19455 13.3055C3.82665 13.9376 4.68395 14.2927 5.57786 14.2927C6.47178 14.2927 7.32908 13.9376 7.96117 13.3055L14.2036 7.06304L15.7041 7.56321L8.96151 14.3058C8.06411 15.2032 6.84698 15.7074 5.57786 15.7074C4.30875 15.7074 3.09162 15.2032 2.19422 14.3058C1.29682 13.4084 0.792664 12.1913 0.792664 10.9222C0.792664 9.65305 1.29682 8.43592 2.19422 7.53852L8.43666 1.29609C9.07914 0.653606 9.95054 0.292664 10.8591 0.292664C11.7678 0.292664 12.6392 0.653606 13.2816 1.29609C13.9241 1.93857 14.2851 2.80997 14.2851 3.71857C14.2851 4.62718 13.9241 5.49858 13.2816 6.14106L7.03213 12.3838C6.64459 12.7712 6.11905 12.9888 5.57107 12.9888C5.02297 12.9888 4.49731 12.7711 4.10974 12.3835C3.72217 11.9959 3.50444 11.4703 3.50444 10.9222C3.50444 10.3741 3.72217 9.8484 4.10974 9.46084L9.877 3.70039L11.3772 4.20144L5.11 10.4613C4.98779 10.5835 4.91913 10.7493 4.91913 10.9222C4.91913 11.0951 4.98782 11.2609 5.11008 11.3832C5.23234 11.5054 5.39817 11.5741 5.57107 11.5741C5.74398 11.5741 5.9098 11.5054 6.03206 11.3832L12.2816 5.14045C12.6586 4.7633 12.8704 4.25185 12.8704 3.71857C12.8704 3.18516 12.6585 2.6736 12.2813 2.29643C11.9041 1.91925 11.3926 1.70735 10.8591 1.70735Z" fill="currentColor"></path></svg>';
  }

  function svgCpu(size) {
    return '<svg fill="none" height="' + size + '" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="' + size + '"><path d="M4 12C4 8.22876 4 6.34315 5.17157 5.17157C6.34315 4 8.22876 4 12 4C15.7712 4 17.6569 4 18.8284 5.17157C20 6.34315 20 8.22876 20 12C20 15.7712 20 17.6569 18.8284 18.8284C17.6569 20 15.7712 20 12 20C8.22876 20 6.34315 20 5.17157 18.8284C4 17.6569 4 15.7712 4 12Z"></path><path d="M9.5 2V4"></path><path d="M14.5 2V4"></path><path d="M9.5 20V22"></path><path d="M14.5 20V22"></path><path d="M13 9L9 13"></path><path d="M15 13L13 15"></path><path d="M22 14.5L20 14.5"></path><path d="M4 9.5L2 9.5"></path><path d="M4 14.5L2 14.5"></path><path d="M22 9.5L20 9.5"></path></svg>';
  }

  function svgChevronDown(size) {
    return '<svg height="' + size + '" viewBox="0 0 16 16" width="' + size + '"><path d="M12.0607 6.74999L8.7071 10.1035C8.31657 10.4941 7.68341 10.4941 7.29288 10.1035L3.93933 6.74999L4.99999 5.68933L7.99999 8.68933L11 5.68933L12.0607 6.74999Z" fill="currentColor"></path></svg>';
  }

  function svgCheckCircle(size) {
    return '<svg height="' + size + '" viewBox="0 0 16 16" width="' + size + '"><path d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM11.5303 6.53033L12.0607 6L11 4.93934L10.4697 5.46967L6.5 9.43934L5.53033 8.46967L5 7.93934L3.93934 9L4.46967 9.53033L5.96967 11.0303C6.26256 11.3232 6.73744 11.3232 7.03033 11.0303L11.5303 6.53033Z" fill="currentColor"></path></svg>';
  }

  function svgClose(size) {
    return '<svg height="' + size + '" viewBox="0 0 16 16" width="' + size + '"><path d="M3.72 3.72L8 8l4.28-4.28 1.06 1.06L9.06 9.06l4.28 4.28-1.06 1.06L8 10.12l-4.28 4.28-1.06-1.06 4.28-4.28-4.28-4.28 1.06-1.06Z" fill="currentColor"></path></svg>';
  }

  function svgLock(size) {
    return '<svg height="' + size + '" viewBox="0 0 24 24" width="' + size + '" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
  }

  function svgServerKey(size) {
    return '<svg height="' + size + '" viewBox="0 0 24 24" width="' + size + '" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10V7a5 5 0 0 1 10 0v3"></path><rect x="4" y="10" width="16" height="10" rx="2"></rect><path d="M12 13v4"></path></svg>';
  }

  function svgTerminal(size) {
    return '<svg height="' + size + '" viewBox="0 0 24 24" width="' + size + '" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>';
  }

  function svgAlertCircle(size) {
    return '<svg height="' + size + '" viewBox="0 0 24 24" width="' + size + '" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }

  function githubMark() {
    return '<svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.303 3.438 9.801 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.727-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.763-1.605-2.665-.304-5.467-1.333-5.467-5.93 0-1.311.468-2.381 1.236-3.221-.125-.304-.536-1.525.116-3.176 0 0 1.009-.323 3.301 1.23A11.487 11.487 0 0 1 12 5.8c1.02.005 2.047.138 3.006.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.651.242 2.872.118 3.176.769.84 1.234 1.91 1.234 3.221 0 4.609-2.807 5.624-5.48 5.921.43.372.823 1.103.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.798 24 17.301 24 12 24 5.373 18.627 0 12 0Z"></path></svg>';
  }

  function buildCapabilitiesFromProviders() {
    var providers = window.KeyManagerProviders || [];
    if (!providers.length) return null;
    var result = { providers: {} };
    providers.forEach(function (provider) {
      if (!provider.models || !provider.models.length) return;
      var models = {};
      provider.models.filter(function (m) { return m.active !== false; }).forEach(function (model) {
        models[model.id] = {
          name: model.name,
          description: model.description || '',
          isDefault: !!model.isDefault,
          supportsThinkingMode: !!model.supportsThinkingMode
        };
      });
      if (!Object.keys(models).length) return;
      result.providers[provider.id] = {
        enabled: true,
        fileInputEnabled: !provider.cliOnly,
        allowedFileTypes: [],
        models: models
      };
    });
    return Object.keys(result.providers).length ? result : null;
  }

  function isCliProvider(providerId) {
    var providers = window.KeyManagerProviders || [];
    return providers.some(function (p) { return p.id === providerId && p.cliOnly; });
  }

  function getProviderName(providerId) {
    var providers = window.KeyManagerProviders || [];
    for (var i = 0; i < providers.length; i++) {
      if (providers[i].id === providerId) return providers[i].name;
    }
    return providerId.charAt(0).toUpperCase() + providerId.slice(1);
  }

  function githubMarkSmall() {
    return '<svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.303 3.438 9.801 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.727-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.763-1.605-2.665-.304-5.467-1.333-5.467-5.93 0-1.311.468-2.381 1.236-3.221-.125-.304-.536-1.525.116-3.176 0 0 1.009-.323 3.301 1.23A11.487 11.487 0 0 1 12 5.8c1.02.005 2.047.138 3.006.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.651.242 2.872.118 3.176.769.84 1.234 1.91 1.234 3.221 0 4.609-2.807 5.624-5.48 5.921.43.372.823 1.103.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.798 24 17.301 24 12 24 5.373 18.627 0 12 0Z"></path></svg>';
  }

  window.StaticPromptPort = {
    create: createPromptPort
  };
})();
