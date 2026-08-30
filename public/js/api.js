/* API client + session store */
window.API = (() => {
  const TOKEN_KEY = 'idms.token';
  let token = localStorage.getItem(TOKEN_KEY) || null;
  let profile = null;
  let onUnauthorized = () => {};

  async function req(method, path, body, isForm) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch('/api' + path, {
      method,
      headers,
      body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      onUnauthorized();
      throw new Error('Session expired');
    }
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
      const msg = json && json.error ? json.error.message : `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  return {
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    put: (p, b) => req('PUT', p, b),
    del: (p) => req('DELETE', p),
    upload: (p, file, comment) => {
      const fd = new FormData();
      fd.append('file', file);
      if (comment) fd.append('comment', comment);
      return req('POST', p, fd, true);
    },
    setToken(t) { token = t; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); },
    getToken: () => token,
    setProfile(p) { profile = p; },
    getProfile: () => profile,
    can(code) {
      if (!profile) return false;
      return profile.role_code === 'ADMIN' || (profile.permissions || []).includes(code) || (profile.permissions || []).includes('*');
    },
    onUnauthorized(fn) { onUnauthorized = fn; }
  };
})();
