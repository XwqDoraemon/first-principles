(function () {
  const AUTH_SUPABASE_URL = 'https://bmstklfbnyevuyxidmhv.supabase.co';
  const AUTH_SUPABASE_ANON_KEY = 'sb_publishable_wnQx8LZ7qUgVAsVOaEnuVQ_Ede5tM3w';

  if (typeof window.supabase === 'undefined') {
    console.error('Supabase SDK is not loaded');
    return;
  }

  if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      AUTH_SUPABASE_URL,
      AUTH_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'first-principles-auth',
        },
      }
    );
  }

  const supabaseClient = window.supabaseClient;
  window.APP_SUPABASE_URL = AUTH_SUPABASE_URL;
  window.APP_SUPABASE_ANON_KEY = AUTH_SUPABASE_ANON_KEY;
  let creditsRequestInFlight = null;
  let lastKnownSession = null;
  let authInitPromise = null;

  function cacheSession(session) {
    if (session?.user) {
      lastKnownSession = session;
    } else if (session === null) {
      lastKnownSession = null;
    }
    return lastKnownSession;
  }

  async function getCurrentUser() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        cacheSession(session);
        return session.user;
      }

      return lastKnownSession?.user || null;
    } catch (error) {
      return lastKnownSession?.user || null;
    }
  }

  async function getCurrentSession() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        return cacheSession(session);
      }

      return lastKnownSession || null;
    } catch (error) {
      return lastKnownSession || null;
    }
  }

  async function getFreshSession() {
    const currentSession = await getCurrentSession();
    if (!currentSession?.user) {
      return null;
    }

    const expiresAt = currentSession.expires_at ? currentSession.expires_at * 1000 : 0;
    const msUntilExpiry = expiresAt ? expiresAt - Date.now() : Number.POSITIVE_INFINITY;

    if (msUntilExpiry > 60 * 1000) {
      return currentSession;
    }

    if (!supabaseClient.auth.refreshSession) {
      return currentSession;
    }

    try {
      const { data, error } = await supabaseClient.auth.refreshSession();
      if (!error && data.session?.access_token) {
        return cacheSession(data.session);
      }
    } catch (error) {
      // Fall back to the current session if refresh is temporarily unavailable.
    }

    return currentSession;
  }

  function onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        cacheSession(session);
      } else if (event === 'SIGNED_OUT') {
        cacheSession(null);
      }
      callback(event, session?.user || null);
    });
  }

  async function restoreSessionFromUrl() {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const hasTokenHash = window.location.hash.includes('access_token');

      if (!code && !hasTokenHash) {
        return;
      }

      if (code) {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.auth.getSession();
        if (error) throw error;
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        cacheSession(session);
      }

      window.history.replaceState({}, document.title, url.pathname);
    } catch (error) {
      console.error('OAuth session restore failed:', error);
    }
  }

  async function signInWithGoogle() {
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      console.log('Google OAuth redirectTo:', redirectUrl);

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      alert('Sign-in failed. Please try again.');
    }
  }

  async function signInWithEmail(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function signUpWithEmail(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function signOut() {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out failed:', error);
      alert('Sign-out failed. Please try again.');
    }
  }

  function updateUserUI(user) {
    const userMenu = document.getElementById('userMenu');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const authButtonContainer = document.getElementById('authButtonContainer');

    if (user) {
      const email = user.email;
      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

      if (userName) userName.textContent = email;
      if (userAvatar) {
        if (userAvatar.tagName === 'IMG') {
          if (avatarUrl) userAvatar.src = avatarUrl;
        } else {
          userAvatar.textContent = (email || 'U').charAt(0).toUpperCase();
        }
      }

      if (userMenu) userMenu.style.display = 'flex';
      if (authButtonContainer) authButtonContainer.style.display = 'none';
    } else {
      if (userMenu) userMenu.style.display = 'none';
      if (authButtonContainer) authButtonContainer.style.display = 'block';
    }
  }

  function renderUserCredits(data) {
    const creditsDisplay = document.getElementById('userCredits');
    if (!creditsDisplay) return;

    const freeSessions = data.freeSessionsRemaining || 0;
    const credits = data.credits || 0;
    creditsDisplay.textContent = freeSessions > 0
      ? `${freeSessions} free sessions · ${credits} credits`
      : `${credits} credits`;
  }

  async function fetchCreditsWithSession(session) {
    if (!session?.access_token) {
      return null;
    }

    return fetch(`${AUTH_SUPABASE_URL}/functions/v1/payment/credits`, {
      method: 'GET',
      headers: {
        'apikey': AUTH_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
  }

  async function displayUserCredits() {
    if (creditsRequestInFlight) {
      return creditsRequestInFlight;
    }

    creditsRequestInFlight = (async () => {
      let session = await getFreshSession();
      if (!session?.user) return;

      try {
        let response = await fetchCreditsWithSession(session);

        if (response?.status === 401) {
          const { data, error } = await supabaseClient.auth.refreshSession();
          if (!error && data.session?.access_token) {
            session = data.session;
            response = await fetchCreditsWithSession(session);
          }
        }

        if (!response?.ok) {
          return;
        }

        const data = await response.json();
        renderUserCredits(data);
      } catch (error) {
        console.error('Failed to load credits:', error);
      } finally {
        creditsRequestInFlight = null;
      }
    })();

    return creditsRequestInFlight;
  }

  window.signInWithGoogle = signInWithGoogle;
  window.signInWithEmail = signInWithEmail;
  window.signUpWithEmail = signUpWithEmail;
  window.signOut = signOut;
  window.getCurrentUser = getCurrentUser;
  window.getCurrentSession = getCurrentSession;
  window.getFreshSession = getFreshSession;
  window.onAuthStateChange = onAuthStateChange;
  window.refreshUserCredits = displayUserCredits;
  window.whenAuthReady = async () => {
    if (!authInitPromise) {
      authInitPromise = Promise.resolve();
    }
    return authInitPromise;
  };

  async function initAuthUI() {
    await restoreSessionFromUrl();

    onAuthStateChange((event, user) => {
      updateUserUI(user);
      if (user && event !== 'INITIAL_SESSION') displayUserCredits();
    });

    const session = await getCurrentSession();
    const user = session?.user || null;
    updateUserUI(user);
    if (user) displayUserCredits();
  }

  if (document.readyState === 'loading') {
    authInitPromise = new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', async () => {
        await initAuthUI();
        resolve();
      }, { once: true });
    });
  } else {
    authInitPromise = initAuthUI();
  }
})();
