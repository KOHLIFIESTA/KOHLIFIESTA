(function(){
  const overlayId = 'authOverlay';
  const controlsId = 'authControls';

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || response.statusText);
    }
    return response.json();
  }

  let currentAuthOverlayOptions = { requireLogin: false };

  function buildAuthOverlay() {
    if (document.getElementById(overlayId)) return;
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-card">
        <h2>Sign in with Discord</h2>
        <p>Welcome to Arab Online RP. To use the full website, please sign in with Discord to enter the shop or purchase items. You can still browse the site as a guest.</p>
        <button id="authLoginButton" class="auth-submit">Continue with Discord</button>
        <button id="authSkipButton" class="auth-button light">Continue as guest</button>
        <button id="authCancelButton" class="auth-link">Cancel</button>
        <div class="auth-note">New users receive 50 starting points. Invite friends for 100 bonus points each.</div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('authLoginButton').addEventListener('click', () => {
      window.location.href = '/auth/discord?next=' + encodeURIComponent(window.location.pathname + window.location.hash);
    });
    document.getElementById('authSkipButton').addEventListener('click', () => {
      if (currentAuthOverlayOptions.requireLogin) {
        window.location.href = 'index.html';
        return;
      }
      hideAuthOverlay();
    });
    document.getElementById('authCancelButton').addEventListener('click', () => {
      if (currentAuthOverlayOptions.requireLogin) {
        window.location.href = 'index.html';
        return;
      }
      hideAuthOverlay();
    });
  }

  function showAuthOverlay(options = {}) {
    currentAuthOverlayOptions = { requireLogin: false, ...options };
    buildAuthOverlay();
    const skipButton = document.getElementById('authSkipButton');
    const cancelButton = document.getElementById('authCancelButton');
    if (skipButton) {
      skipButton.textContent = currentAuthOverlayOptions.requireLogin ? 'Back to home' : 'Continue as guest';
      skipButton.style.display = currentAuthOverlayOptions.requireLogin ? 'inline-flex' : 'inline-flex';
    }
    if (cancelButton) {
      cancelButton.textContent = currentAuthOverlayOptions.requireLogin ? 'Back to home' : 'Cancel';
      cancelButton.style.display = currentAuthOverlayOptions.requireLogin ? 'inline-flex' : 'inline-flex';
    }
    document.body.classList.add('auth-locked');
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.style.display = 'flex';
  }

  function hideAuthOverlay() {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('auth-locked');
  }

  async function getSession() {
    try {
      return await fetchJson('/api/session');
    } catch (error) {
      return { authenticated: false };
    }
  }

  function createNavControls() {
    const nav = document.querySelector('header nav, body > nav');
    if (!nav) return null;
    let controls = document.getElementById(controlsId);
    if (!controls) {
      controls = document.createElement('div');
      controls.id = controlsId;
      controls.style.marginLeft = '14px';
      nav.appendChild(controls);
    }
    return controls;
  }

  async function renderAuthControls(session) {
    const controls = createNavControls();
    if (!controls) return;
    if (session.authenticated) {
      const avatar = session.user.avatar ? `<a href="profile.html"><img src="${session.user.avatar}" alt="avatar" style="width:36px;height:36px;border-radius:50%;margin-right:8px;border:2px solid rgba(255,208,0,0.12);vertical-align:middle"></a>` : '';
      controls.innerHTML = `
        ${avatar}
        <span class="auth-pill">${session.user.username} | ${session.user.points} pts</span>
        <button class="auth-button" id="authInviteButton">Invite</button>
        <button class="auth-button light" id="authLogoutButton">Sign out</button>
      `;
      document.getElementById('authInviteButton').addEventListener('click', async () => {
        try {
          const data = await fetchJson('/api/invite-link');
          navigator.clipboard.writeText(data.link).then(() => {
            alert('Referral link copied to clipboard!');
          });
        } catch (error) {
          alert('Unable to copy invite link.');
        }
      });
      document.getElementById('authLogoutButton').addEventListener('click', async () => {
        await fetchJson('/api/logout', { method: 'POST' });
        window.location.reload();
      });
    } else {
      controls.innerHTML = `<button class="auth-button" id="authSignInButton">Sign in</button>`;
      document.getElementById('authSignInButton').addEventListener('click', showAuthOverlay);
    }
  }

  async function handleReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      await fetch('/api/track-ref?ref=' + encodeURIComponent(ref));
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    }
  }

  async function init() {
    buildAuthOverlay();
    await handleReferral();
    const session = await getSession();
    await renderAuthControls(session);
  }

  window.auth = {
    showAuthOverlay,
    getSession,
    renderAuthControls,
    requireAuth: async function(){
      const session = await getSession();
      if (!session.authenticated) { showAuthOverlay({ requireLogin: true }); return false; }
      return true;
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
