/**
 * Auth Plugin - Unified authentication injection for host pages
 *
 * Drop this single script into any page to get full auth functionality:
 *   <script src="/chat/betterauth/public/js/auth-plugin.js" defer></script>
 *
 * The plugin will:
 *   1. Detect environment and configure AUTH_API_URL
 *   2. Inject sign-in/sign-out UI into #accountPanelInserts (or fallback)
 *   3. Check session on load and update UI accordingly
 *   4. Lazy-load the OAuth modal only when the user clicks "Sign In"
 *
 * Exposes: window.showAuthModal, window.updateAuthUI, window.handleSignOut
 */
(function () {
  'use strict';

  // ── Environment Detection & API URL ──────────────────────────────

  var isLocalhost = ['localhost', '127.0.0.1', '::1'].indexOf(location.hostname) !== -1;

  var authApiUrl = window.AUTH_API_URL;
  if (!authApiUrl) {
    authApiUrl = isLocalhost
      ? window.location.origin + '/api'
      : 'https://api.model.earth/api';
  }
  window.AUTH_API_URL = authApiUrl;

  // ── Logging Helper ───────────────────────────────────────────────

  function log(msg) {
    if (typeof console !== 'undefined') {
      console.log('[Auth Plugin] ' + msg);
    }
  }

  // ── Style Injection ──────────────────────────────────────────────

  var STYLE_ID = 'auth-plugin-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#auth-plugin-signIn {' +
        'padding: 12px 32px;' +
        'background: linear-gradient(135deg, #3094ce 0%, #25a2eb 100%);' +
        'border: 1.5px solid rgba(59,130,246,0.3);' +
        'border-radius: 8px;' +
        'color: #ffffff;' +
        'font-size: 13pt;' +
        'font-weight: 600;' +
        'cursor: pointer;' +
        'transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);' +
        'box-shadow: 0 3px 8px rgba(59,130,246,0.3);' +
        'letter-spacing: 0.02em;' +
        'min-width: 220px;' +
      '}' +
      '#auth-plugin-signIn:hover {' +
        'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);' +
        'border-color: rgba(59,130,246,0.5);' +
        'transform: translateY(-2px);' +
        'box-shadow: 0 5px 14px rgba(59,130,246,0.4);' +
      '}' +
      '#auth-plugin-signIn:active {' +
        'transform: translateY(0) scale(0.97);' +
      '}' +
      '#auth-plugin-signOut {' +
        'display: none;' +
        'padding: 7px 16px;' +
        'background: linear-gradient(135deg, #ff2e2ea4 0%, #ff27274d 100%);' +
        'border: 1.5px solid rgba(239,68,68,0.3);' +
        'border-radius: 7px;' +
        'color: #fef2f2;' +
        'font-size: 11pt;' +
        'font-weight: 600;' +
        'cursor: pointer;' +
        'transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);' +
        'box-shadow: 0 2px 5px rgba(220,38,38,0.3);' +
        'letter-spacing: 0.01em;' +
      '}' +
      '#auth-plugin-signOut:hover {' +
        'background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);' +
        'border-color: rgba(239,68,68,0.5);' +
        'color: #ffffff;' +
        'box-shadow: 0 3px 10px rgba(220,38,38,0.4);' +
      '}' +
      '#auth-plugin-signOut:active {' +
        'transform: scale(0.97);' +
      '}' +
      '.auth-plugin-user-info {' +
        'display: none;' +
        'text-align: center;' +
        'margin-bottom: 25px;' +
      '}' +
      '.auth-plugin-avatar {' +
        'width: 64px; height: 64px; border-radius: 50%;' +
        'object-fit: cover;' +
        'border: 2.5px solid rgba(96,165,250,0.3);' +
        'box-shadow: 0 3px 8px rgba(0,0,0,0.3);' +
        'margin: 12px auto;' +
        'display: none;' +
      '}' +
      '.auth-plugin-name {' +
        'font-size: 14.5pt; font-weight: 600; color: #f7fafc;' +
        'letter-spacing: -0.02em;' +
      '}' +
      '.auth-plugin-email {' +
        'font-size: 10pt; color: #94a3b8; font-weight: 400;' +
        'letter-spacing: 0.01em; margin-top: 3px;' +
      '}' +
      '.auth-plugin-fallback {' +
        'position: fixed; top: 8px; right: 12px; z-index: 10000;' +
      '}';
    document.head.appendChild(style);
  }

  // ── UI Injection ─────────────────────────────────────────────────

  function buildAuthHTML() {
    return (
      '<!-- Auth Plugin: Account Header -->' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div style="font-size:16pt;">Account</div>' +
        '<button id="auth-plugin-signOut">\uD83D\uDEAA Sign Out</button>' +
      '</div>' +
      '<!-- Auth Plugin: Sign-In Container -->' +
      '<div id="auth-plugin-signIn-container" style="width:100%;text-align:center;">' +
        '<div class="sign-in-container">' +
          '<button id="auth-plugin-signIn">' +
            '<span style="display:inline-flex;align-items:center;gap:8px;">Sign In</span>' +
          '</button>' +
          '<br><br>' +
        '</div>' +
        '<div class="auth-plugin-user-info user-info-container">' +
          '<div style="margin-bottom:12px;margin-top:12px;">' +
            '<img class="auth-plugin-avatar" id="auth-plugin-avatar" src="" alt="">' +
          '</div>' +
          '<div>' +
            '<div class="auth-plugin-name" id="auth-plugin-name"></div>' +
            '<div class="auth-plugin-email" id="auth-plugin-email"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function attachEventListeners() {
    var signInBtn = document.getElementById('auth-plugin-signIn');
    if (signInBtn) {
      signInBtn.addEventListener('click', function () {
        if (typeof goHash === 'function') {
          goHash({'popup': 'login'});
        } else {
          showAuthModal();
        }
      });
    }

    var signOutBtn = document.getElementById('auth-plugin-signOut');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        handleSignOut();
      });
    }
  }

  // ── Session Check & UI Update ────────────────────────────────────

  function showUser(user, signInContainer, userInfoContainer) {
    log('User authenticated: ' + user.name);
    if (signInContainer) signInContainer.style.display = 'none';
    if (userInfoContainer) {
      userInfoContainer.style.display = 'block';
      var signOutBtn = document.getElementById('auth-plugin-signOut');
      if (signOutBtn) signOutBtn.style.display = 'inline-block';
      var avatar = document.getElementById('auth-plugin-avatar');
      if (avatar && user.image) {
        avatar.src = user.image;
        avatar.style.display = 'block';
      } else if (avatar) {
        avatar.style.display = 'none';
      }
      var nameEl = document.getElementById('auth-plugin-name');
      if (nameEl) nameEl.textContent = user.name;
      var emailEl = document.getElementById('auth-plugin-email');
      if (emailEl && user.email) emailEl.textContent = user.email;
    }
  }

  function updateAuthUI() {
    var signInContainer = document.querySelector('.sign-in-container');
    var userInfoContainer = document.querySelector('.auth-plugin-user-info') ||
                            document.querySelector('.user-info-container');

    log('Updating authentication UI state');

    // After OAuth redirect the relay encodes user info in the URL hash so we
    // never need a cross-origin get-session fetch (blocked in Chrome incognito).
    // Parse hash manually — URLSearchParams would decode %2B to + then treat + as
    // space, corrupting standard base64. Manual parsing + decodeURIComponent is safe.
    var authUserEncoded = null;
    var rawHash = location.hash.slice(1);
    rawHash.split('&').forEach(function(pair) {
      var eq = pair.indexOf('=');
      if (eq > -1 && pair.slice(0, eq) === 'auth_user') {
        authUserEncoded = decodeURIComponent(pair.slice(eq + 1));
      }
    });
    if (authUserEncoded) {
      try {
        // Accept both base64url (relay v2: -, _) and standard base64 (relay v1: +, /)
        var b64 = authUserEncoded.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        var user = JSON.parse(decodeURIComponent(atob(b64)));
        if (user && user.id) {
          history.replaceState(null, '', location.pathname + location.search);
          showUser(user, signInContainer, userInfoContainer);
          return;
        }
      } catch (e) {
        log('Error parsing auth_user from hash: ' + e);
      }
    }

    fetch(authApiUrl + '/auth/get-session', { credentials: 'include' })
      .then(function (response) {
        if (!response.ok) throw new Error('Session check failed');
        return response.json();
      })
      .then(function (result) {
        if (result && result.user) {
          showUser(result.user, signInContainer, userInfoContainer);
          return;
        }
        showSignedOut(signInContainer, userInfoContainer);
      })
      .catch(function (e) {
        log('Error checking authentication: ' + e);
        showSignedOut(signInContainer, userInfoContainer);
      });
  }

  function showSignedOut(signInContainer, userInfoContainer) {
    log('No authenticated user');
    if (signInContainer) signInContainer.style.display = 'block';
    if (userInfoContainer) userInfoContainer.style.display = 'none';
    var signOutBtn = document.getElementById('auth-plugin-signOut');
    if (signOutBtn) signOutBtn.style.display = 'none';
  }

  // ── Sign Out ─────────────────────────────────────────────────────

  function handleSignOut() {
    log('Signing out user');
    fetch(authApiUrl + '/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function () { window.location.reload(); })
      .catch(function (e) {
        log('Error during sign-out: ' + e);
        window.location.reload();
      });
  }

  // ── Lazy-Load Auth Modal ─────────────────────────────────────────

  function showAuthModal() {
    if (window.authModal) {
      window.authModal.show();
      return;
    }

    // Resolve path to auth-modal.js relative to this script
    var modalPath = resolveModalPath();
    log('Lazy-loading auth modal from: ' + modalPath);

    var script = document.createElement('script');
    script.src = modalPath;
    script.onload = function () {
      if (window.authModal) {
        window.authModal.show();
      }
    };
    script.onerror = function () {
      log('Failed to load auth-modal.js');
    };
    document.head.appendChild(script);
  }

  function resolveModalPath() {
    // If host page set a custom path, use it
    if (window.AUTH_MODAL_PATH) return window.AUTH_MODAL_PATH;

    // Detect path from the current script's src
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('auth-plugin.js') !== -1) {
        return src.replace('auth-plugin.js', 'auth-modal.js');
      }
    }

    // Fallback
    return (window.appBaseUrl || '/') + 'betterauth/js/auth-modal.js';
  }

  // ── Mount Point Detection & Init ─────────────────────────────────

  var MOUNT_ID = 'accountPanelInserts';
  var FALLBACK_MS = 15000;
  var injected = false;

  function inject(target, isFallback) {
    if (injected) return;
    injected = true;
    injectStyles();

    if (isFallback) {
      var wrapper = document.createElement('div');
      wrapper.className = 'auth-plugin-fallback';
      var btn = document.createElement('button');
      btn.id = 'auth-plugin-signIn';
      btn.textContent = 'Sign In';
      btn.style.cssText =
        'padding:8px 20px;background:#3b82f6;color:#fff;border:none;' +
        'border-radius:6px;font-size:12pt;font-weight:600;cursor:pointer;';
      btn.addEventListener('click', showAuthModal);
      wrapper.appendChild(btn);
      document.body.insertBefore(wrapper, document.body.firstChild);
      log('Fallback sign-in button injected');
    } else {
      target.innerHTML = buildAuthHTML() + target.innerHTML;
      attachEventListeners();
      log('Auth UI injected into #' + MOUNT_ID);
    }

    updateAuthUI();
  }

  function init() {
    // Already in DOM (static HTML or template already loaded)
    var existing = document.getElementById(MOUNT_ID);
    if (existing) {
      inject(existing, false);
      return;
    }

    // template-main.html is fetched via AJAX by localsite.js, so #accountPanelInserts
    // won't exist until that async load completes. Use MutationObserver to detect it.
    log('Waiting for #' + MOUNT_ID + ' (async template load)...');

    var observeTarget = document.body || document.documentElement;
    var observer = new MutationObserver(function () {
      var el = document.getElementById(MOUNT_ID);
      if (el) {
        observer.disconnect();
        clearTimeout(fallbackTimer);
        inject(el, false);
      }
    });

    observer.observe(observeTarget, { childList: true, subtree: true });

    // If the mount point never appears, fall back to floating button
    var fallbackTimer = setTimeout(function () {
      observer.disconnect();
      if (!injected) {
        log('#' + MOUNT_ID + ' not found after ' + FALLBACK_MS + 'ms, using fallback');
        inject(null, true);
      }
    }, FALLBACK_MS);
  }

  // ── Global API ───────────────────────────────────────────────────

  window.showAuthModal = showAuthModal;
  window.updateAuthUI = updateAuthUI;
  window.handleSignOut = handleSignOut;

  // ── Hash-based popup trigger ─────────────────────────────────────

  document.addEventListener('hashChangeEvent', function () {
    var hash = typeof getHash === 'function' ? getHash() : {};
    if (hash.popup === 'login') {
      showAuthModal();
    }
  });

  // ── Start ────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
