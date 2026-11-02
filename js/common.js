/* ============================================================
   StreamVibe - Shared logic (nav, storage, watchlist,
   watch history, parental controls, localStorage auth)
   ============================================================ */

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

/* ---------- Watchlist ---------- */
const Watchlist = {
  all() { return Store.get("sv_watchlist", []); },
  has(id) { return this.all().includes(id); },
  toggle(id) {
    let list = this.all();
    if (list.includes(id)) list = list.filter(x => x !== id);
    else list.push(id);
    Store.set("sv_watchlist", list);
    return list.includes(id);
  },
  clear() { Store.set("sv_watchlist", []); }
};

/* ---------- Watch history (drives recommendations) ---------- */
const History = {
  all() { return Store.get("sv_history", []); },
  add(id) {
    let list = this.all().filter(x => x !== id);
    list.unshift(id);
    list = list.slice(0, 20);
    Store.set("sv_history", list);
  },
  clear() { Store.set("sv_history", []); }
};

/* ---------- Progress per video ---------- */
const Progress = {
  get(id) { return Store.get("sv_progress_" + id, 0); },
  set(id, seconds) { Store.set("sv_progress_" + id, seconds); }
};

/* ============================================================
   Parental controls - PER VIDEO
   An administrator marks a video as protected (admin panel).
   Protected videos ask for the PIN before playing (default 1234);
   everything else plays directly.
   Entering the PIN unlocks that video for the current page view
   only, so the PIN is asked again on the next visit.
   ============================================================ */
const sessionUnlocked = new Set();   // video ids unlocked this page view

const Parental = {
  DEMO_PIN: "1234",                          // default PIN for all videos

  protectedMap() { return Store.get("sv_video_parental", {}); },
  isProtected(video) { return !!this.protectedMap()[video.id]; },
  setProtected(id, on) {
    const map = this.protectedMap();
    if (on) map[id] = true;
    else delete map[id];
    Store.set("sv_video_parental", map);
  },
  protectedVideos() {
    const ids = Object.keys(this.protectedMap());
    const cat = (typeof CATALOGUE !== "undefined") ? CATALOGUE : [];
    return cat.filter((v) => ids.includes(v.id)).map((v) => ({ id: v.id, title: v.title }));
  },

  pin() { return Store.get("sv_parental_pin", this.DEMO_PIN); },
  isPinDefault() { return Store.get("sv_parental_pin", null) === null; },
  setPin(p) { Store.set("sv_parental_pin", p); },
  resetPin() { localStorage.removeItem("sv_parental_pin"); },

  isLocked(video) {
    if (sessionUnlocked.has(video.id)) return false;
    return this.isProtected(video);
  },
  unlock(video) { sessionUnlocked.add(video.id); },   // session only

  resetAll() {
    Store.set("sv_video_parental", {});
    this.resetPin();
    sessionUnlocked.clear();
  }
};

/* ============================================================
   MediaStore - keeps uploaded video/image files in the browser
   - file:// pages (Chrome blocks IndexedDB there): localStorage data URLs
   - served pages (http/https): IndexedDB blobs (much higher quota)
   ============================================================ */
const MediaStore = (() => {
  const LS_PREFIX = "sv_media_";
  let mode = null;          // "ls" | "idb"
  let idb = null;

  function detect() {
    if (mode) return mode;
    mode = (location.protocol === "file:") ? "ls" : "idb";
    return mode;
  }

  function openIdb() {
    if (idb) return Promise.resolve(idb);
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; idb = v; resolve(v); } };
      try {
        const req = indexedDB.open("streamvibe_media", 1);
        req.onupgradeneeded = () => { req.result.createObjectStore("blobs"); };
        req.onsuccess = () => done(req.result);
        req.onerror = () => done(null);
        setTimeout(() => done(null), 1500);
      } catch (e) { done(null); }
    });
  }

  const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

  async function put(id, file) {
    if (detect() === "idb") {
      const db = await openIdb();
      if (db) {
        try {
          await new Promise((res, rej) => {
            const tx = db.transaction("blobs", "readwrite");
            tx.objectStore("blobs").put(file, id);
            tx.oncomplete = res;
            tx.onerror = () => rej(tx.error);
            tx.onabort = () => rej(tx.error);
          });
          return { ok: true, mode: "idb" };
        } catch (e) { /* fall through to localStorage */ }
      }
    }
    // localStorage fallback (data URL)
    try {
      const dataUrl = await readAsDataURL(file);
      localStorage.setItem(LS_PREFIX + id, dataUrl);
      return { ok: true, mode: "ls" };
    } catch (e) {
      return {
        ok: false,
        msg: "File is too large for browser storage" +
             (location.protocol === "file:" ? " (~4 MB limit when opened as a file)" : "") +
             ". Use a shorter/smaller clip, or serve the folder over localhost."
      };
    }
  }

  async function getURL(id) {
    if (detect() === "idb") {
      const db = await openIdb();
      if (db) {
        try {
          const blob = await new Promise((res, rej) => {
            const tx = db.transaction("blobs", "readonly");
            const g = tx.objectStore("blobs").get(id);
            g.onsuccess = () => res(g.result);
            g.onerror = () => rej(g.error);
          });
          if (blob) return URL.createObjectURL(blob);
        } catch (e) { /* fall through */ }
      }
    }
    const dataUrl = localStorage.getItem(LS_PREFIX + id);
    return dataUrl || null;
  }

  async function remove(id) {
    localStorage.removeItem(LS_PREFIX + id);
    if (detect() === "idb") {
      const db = await openIdb();
      if (db) {
        try {
          const tx = db.transaction("blobs", "readwrite");
          tx.objectStore("blobs").delete(id);
        } catch (e) { /* ignore */ }
      }
    }
  }

  return { put, getURL, remove };
})();

/* ============================================================
   Auth - users are stored in localStorage (sv_users),
   the signed-in session is stored in sv_user
   ============================================================ */
const Auth = {
  SEED_USERS: [
    { name: "Demo Viewer", email: "demo@streamvibe.com", password: "demo123", role: "viewer" },
    { name: "Demo Creator", email: "creator@streamvibe.com", password: "demo123", role: "creator" },
    { name: "Demo Admin", email: "admin@streamvibe.com", password: "admin123", role: "admin" }
  ],

  seed() {
    if (localStorage.getItem("sv_users") === null) Store.set("sv_users", this.SEED_USERS);
  },
  users() { return Store.get("sv_users", []); },

  signup(name, email, password, role) {
    email = (email || "").trim().toLowerCase();
    if (!email || !password) return { ok: false, msg: "Email and password are required." };
    if (this.users().some((u) => u.email === email))
      return { ok: false, msg: "That email is already registered — try Log in." };
    const user = {
      name: (name || "").trim() || email.split("@")[0],
      email,
      password,
      role: role || "viewer"
    };
    const list = this.users();
    list.push(user);
    Store.set("sv_users", list);
    this.setSession(user);
    return { ok: true, user };
  },

  verify(email, password) {
    email = (email || "").trim().toLowerCase();
    return this.users().find((u) => u.email === email && u.password === password) || null;
  },

  login(email, password) {
    const user = this.verify(email, password);
    if (!user) return { ok: false, msg: "Wrong email or password." };
    this.setSession(user);
    return { ok: true, user };
  },

  setSession(user) {
    Store.set("sv_user", { name: user.name, email: user.email, role: user.role });
  },
  current() { return Store.get("sv_user", null); },
  logout() { localStorage.removeItem("sv_user"); }
};
Auth.seed();

/* ============================================================
   Subscriptions - admin manages access from the admin panel.
   If a user is deactivated they get a "subscribe to a plan"
   wall instead of content, until they pick a plan again.
   Stored in localStorage: sv_user_subs = { email: {plan, status} }
   ============================================================ */
const Subs = {
  DEFAULT: { plan: "Basic", status: "active" },
  all() { return Store.get("sv_user_subs", {}); },
  forUser(email) {
    if (!email) return { ...this.DEFAULT };
    const rec = this.all()[email];
    return rec ? { ...this.DEFAULT, ...rec } : { ...this.DEFAULT };
  },
  set(email, patch) {
    const all = this.all();
    all[email] = { ...this.forUser(email), ...patch };
    Store.set("sv_user_subs", all);
  },
  isActive(email) { return this.forUser(email).status === "active"; },
  plan(email) { return this.forUser(email).plan; },
  deactivate(email) { this.set(email, { status: "deactivated" }); },
  activate(email, plan) { this.set(email, { status: "active", plan: plan || this.forUser(email).plan }); },
  activeCount(emails) { return emails.filter((e) => this.isActive(e)).length; }
};

function isAdmin() {
  const u = Auth.current();
  if (!u || u.role !== "admin") return false;
  // session must match a real admin account stored in localStorage
  return Auth.users().some((x) => x.email === u.email && x.role === "admin");
}

/* ---------- Rendering helpers ---------- */
function statusBadge(video) {
  if (video.isLive) return '<span class="badge live">● LIVE</span>';
  if (video.isNew) return '<span class="badge new">NEW</span>';
  if (video.trending) return '<span class="badge trend">TRENDING</span>';
  return "";
}

function videoCard(video) {
  const locked = Parental.isLocked(video);
  const inList = Watchlist.has(video.id);
  return `
    <article class="card" data-id="${video.id}">
      <a class="card-media" href="watch.html?id=${video.id}" aria-label="Watch ${video.title}">
        <img src="${video.thumb}" alt="${video.title}" loading="lazy">
        <span class="card-play">▶</span>
        ${statusBadge(video)}
        <span class="card-rating">${video.rating}</span>
        ${locked ? '<span class="card-lock" title="Parental control locked">🔒</span>' : ""}
      </a>
      <div class="card-body">
        <h3 class="card-title">${video.title}</h3>
        <p class="card-meta">${video.year} • ${video.genre} • ${video.duration}</p>
        <div class="card-actions">
          <button class="btn btn-mini wl-btn" data-id="${video.id}">
            ${inList ? "✓ In List" : "+ Watchlist"}
          </button>
          <span class="views">${video.views} views</span>
        </div>
      </div>
    </article>`;
}

function renderRow(container, videos, emptyMsg) {
  if (!container) return;
  if (!videos.length) {
    container.innerHTML = `<p class="empty">${emptyMsg || "Nothing here yet."}</p>`;
    return;
  }
  container.innerHTML = videos.map(videoCard).join("");
}

// Delegate watchlist button clicks anywhere on the page
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".wl-btn");
  if (!btn) return;
  e.preventDefault();
  const added = Watchlist.toggle(btn.dataset.id);
  btn.classList.toggle("active", added);
  btn.innerHTML = added ? "✓ In List" : "+ Watchlist";
  showToast(added ? "Added to your watchlist" : "Removed from watchlist");
});

/* ---------- Toast ---------- */
function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================
   Auth gate modal - log in / sign up (force = cannot dismiss)
   ============================================================ */
function openAuthGate(opts = {}) {
  const tab = opts.tab || "login";
  const force = !!opts.force;
  const onSuccess = opts.onSuccess;

  let modal = document.getElementById("authModal");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.id = "authModal";
  modal.className = "modal-backdrop open";
  modal.innerHTML = `
    <div class="modal">
      <h2>👋 Welcome to StreamVibe</h2>
      <p class="muted">${force ? "Log in or sign up to continue." : "Log in or sign up to continue."}</p>

      <div class="auth-tabs">
        <button class="auth-tab ${tab === "login" ? "active" : ""}" data-tab="login">Log in</button>
        <button class="auth-tab ${tab === "signup" ? "active" : ""}" data-tab="signup">Sign up</button>
      </div>

      <form id="authLoginForm" ${tab === "login" ? "" : "hidden"}>
        <label>Email
          <input type="email" id="authLoginEmail" value="demo@streamvibe.com" autocomplete="email">
        </label>
        <label>Password
          <input type="password" id="authLoginPass" value="demo123" autocomplete="current-password">
        </label>
        <p class="error" id="authLoginErr" hidden></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Log in</button>
        </div>
      </form>

      <form id="authSignupForm" ${tab === "signup" ? "" : "hidden"}>
        <label>Name
          <input type="text" id="authSignupName" placeholder="Your name">
        </label>
        <label>Email
          <input type="email" id="authSignupEmail" placeholder="you@example.com">
        </label>
        <label>Password
          <input type="password" id="authSignupPass" placeholder="Choose a password">
        </label>
        <label>Role
          <select id="authSignupRole">
            <option value="viewer">Viewer</option>
            <option value="creator">Content creator</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <p class="error" id="authSignupErr" hidden></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create account</button>
        </div>
      </form>

      <div class="hint-box">
        💡 Demo accounts (stored in localStorage)<br>
        Viewer: <strong>demo@streamvibe.com / demo123</strong><br>
        Creator: <strong>creator@streamvibe.com / demo123</strong><br>
        Admin: <strong>admin@streamvibe.com / admin123</strong>
      </div>
    </div>`;
  document.body.appendChild(modal);
  if (force) modal.dataset.force = "1";

  /* tabs */
  modal.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll(".auth-tab").forEach((b) => b.classList.toggle("active", b === btn));
      modal.querySelector("#authLoginForm").hidden = btn.dataset.tab !== "login";
      modal.querySelector("#authSignupForm").hidden = btn.dataset.tab !== "signup";
    });
  });

  /* backdrop close only when not forced */
  modal.addEventListener("click", (e) => {
    if (e.target === modal && !force) modal.remove();
  });

  const done = (user) => {
    modal.remove();
    initNav();
    showToast(`Welcome, ${user.name} (${user.role})`);
    // if this account was deactivated, send it straight to the plan wall
    enforceAccess();
    if (typeof onSuccess === "function") onSuccess();
  };

  modal.querySelector("#authLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const res = Auth.login(
      modal.querySelector("#authLoginEmail").value,
      modal.querySelector("#authLoginPass").value
    );
    const err = modal.querySelector("#authLoginErr");
    if (!res.ok) { err.textContent = res.msg; err.hidden = false; return; }
    done(res.user);
  });

  modal.querySelector("#authSignupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const res = Auth.signup(
      modal.querySelector("#authSignupName").value,
      modal.querySelector("#authSignupEmail").value,
      modal.querySelector("#authSignupPass").value,
      modal.querySelector("#authSignupRole").value
    );
    const err = modal.querySelector("#authSignupErr");
    if (!res.ok) { err.textContent = res.msg; err.hidden = false; return; }
    done(res.user);
  });

  setTimeout(() => {
    const first = modal.querySelector(tab === "signup" ? "#authSignupName" : "#authLoginEmail");
    if (first) first.focus();
  }, 50);
}

/* Back-compat alias used by home page plan buttons */
function openLogin() {
  openAuthGate({ tab: "login", force: true });
}

/* ============================================================
   Admin sign-in - checked against localStorage users
   ============================================================ */
const DEMO_ADMIN_EMAIL = "admin@streamvibe.com";

function openAdminLogin(onSuccess) {
  let modal = document.getElementById("adminLoginModal");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.id = "adminLoginModal";
  modal.className = "modal-backdrop open";
  modal.innerHTML = `
    <div class="modal modal-sm">
      <h2>🛡 Admin sign-in</h2>
      <p class="muted">This area is restricted to administrators.</p>
      <div class="hint-box">
        💡 Demo admin account (from localStorage)<br>
        Email: <strong>${DEMO_ADMIN_EMAIL}</strong><br>
        Password: <strong>admin123</strong>
      </div>
      <label>Email
        <input type="email" id="adminEmail" value="${DEMO_ADMIN_EMAIL}">
      </label>
      <label>Password
        <input type="password" id="adminPass" placeholder="Password">
      </label>
      <p class="error" id="adminErr" hidden></p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="adminCreate">Sign up instead</button>
        <button class="btn btn-primary" id="adminOk">Sign in as admin</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#adminEmail").focus();

  const close = () => modal.remove();
  const err = modal.querySelector("#adminErr");

  modal.querySelector("#adminCreate").addEventListener("click", () => {
    openAuthGate({ tab: "signup", force: false, onSuccess });
  });

  const submit = () => {
    const user = Auth.verify(modal.querySelector("#adminEmail").value, modal.querySelector("#adminPass").value);
    if (!user) { err.textContent = "Wrong email or password."; err.hidden = false; return; }
    if (user.role !== "admin") {
      err.textContent = "This account is not an administrator.";
      err.hidden = false;
      return;
    }
    Auth.setSession(user);
    close();
    initNav();
    showToast("Signed in as Administrator 🛡");
    if (typeof onSuccess === "function") onSuccess();
  };

  modal.querySelector("#adminOk").addEventListener("click", submit);
  modal.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

/* ---------- Subscription wall (admin deactivated this user) ---------- */
function showSubscribeWall() {
  const user = Auth.current();
  if (!user) return;
  let modal = document.getElementById("subWall");
  if (modal) modal.remove();

  const plans = Store.get("sv_plans", DEFAULT_PLANS).filter((p) => p.active);
  modal = document.createElement("div");
  modal.id = "subWall";
  modal.className = "modal-backdrop open";
  modal.dataset.force = "1";
  modal.innerHTML = `
    <div class="modal">
      <h2>⛔ Access paused</h2>
      <p class="muted">The subscription for <strong>${user.email}</strong> was deactivated by the administrator.
      Choose a plan to restore access.</p>
      ${plans.length ? `
        <div class="wall-plans">
          ${plans.map((p) => `
            <button class="wall-plan" data-plan="${p.name}">
              <strong>${p.name}</strong>
              <span>${p.price}</span>
            </button>`).join("")}
        </div>` : `<p class="error">No plans are currently available. Contact the administrator.</p>`}
      <div class="hint-box">💡 Demo: pick any plan — it reactivates your access immediately (stored in localStorage).</div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll(".wall-plan").forEach((btn) => {
    btn.addEventListener("click", () => {
      Subs.activate(user.email, btn.dataset.plan);
      modal.remove();
      initNav();
      showToast(`Subscribed to ${btn.dataset.plan} — access restored ✓`);
    });
  });
}

/* ---------- Nav: mobile toggle + user chip ---------- */
function initNav() {
  const burger = document.querySelector(".nav-toggle");
  const menu = document.getElementById("navMenu");
  if (burger && menu) {
    burger.addEventListener("click", () => menu.classList.toggle("open"));
  }

  const userArea = document.getElementById("userArea");
  const user = Auth.current();
  if (userArea) {
    if (user) {
      userArea.innerHTML = `
        <span class="user-chip">${user.name} <em>(${user.role})</em></span>
        <button class="btn btn-ghost" id="logoutBtn">Log out</button>`;
      const lo = document.getElementById("logoutBtn");
      if (lo) lo.addEventListener("click", () => {
        Auth.logout();
        location.reload();
      });
    } else {
      userArea.innerHTML = `<button class="btn btn-ghost" id="loginBtn">Log in</button>`;
      const li = document.getElementById("loginBtn");
      if (li) li.addEventListener("click", () => openAuthGate({ tab: "login", force: true }));
    }
  }

  const wlCount = document.getElementById("wlCount");
  if (wlCount) wlCount.textContent = Watchlist.all().length;

  // Admin links require an admin login first
  document.querySelectorAll('a[href="admin.html"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!isAdmin()) {
        e.preventDefault();
        if (!Auth.current()) {
          openAuthGate({ tab: "login", force: true, onSuccess: () => {
            if (isAdmin()) location.href = "admin.html";
            else openAdminLogin(() => { location.href = "admin.html"; });
          }});
        } else {
          openAdminLogin(() => { location.href = "admin.html"; });
        }
      }
    });
  });
}

/* ---------- Simple PIN prompt (shows demo hint when PIN is default) ---------- */
function askPin(callback) {
  let modal = document.getElementById("pinModal");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.id = "pinModal";
  modal.className = "modal-backdrop open";
  modal.innerHTML = `
    <div class="modal modal-sm">
      <h2>🔒 Parental control</h2>
      <p class="muted">Enter the PIN to play this title.</p>
      ${Parental.isPinDefault() ? `<p class="hint-box">💡 Demo PIN: <strong>${Parental.DEMO_PIN}</strong></p>` : ""}
      <input type="password" id="pinInput" inputmode="numeric" maxlength="6" placeholder="PIN">
      <p class="error" id="pinError" hidden>Incorrect PIN.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="pinCancel">Cancel</button>
        <button class="btn btn-primary" id="pinOk">Unlock</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const input = modal.querySelector("#pinInput");
  setTimeout(() => input.focus(), 50);

  const close = () => modal.remove();
  const submit = () => {
    if (input.value === Parental.pin()) {
      close();
      callback(true, input.value);
    } else {
      modal.querySelector("#pinError").hidden = false;
      input.value = "";
      input.focus();
    }
  };
  modal.querySelector("#pinOk").addEventListener("click", submit);
  modal.querySelector("#pinCancel").addEventListener("click", () => { close(); callback(false); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) { close(); callback(false); } });
}

/* ---------- Merge creator uploads into the shared catalogue ---------- */
(function mergeUploads() {
  if (typeof CATALOGUE === "undefined") return;
  Store.get("sv_extra_videos", []).forEach((v) => {
    if (!CATALOGUE.find((x) => x.id === v.id)) CATALOGUE.push(v);
  });

  // Apply admin overrides (featured / removed) so they survive reloads
  const ov = Store.get("sv_video_overrides", {});
  Object.keys(ov).forEach((id) => {
    const o = ov[id];
    const i = CATALOGUE.findIndex((v) => v.id === id);
    if (o.removed) {
      if (i > -1) CATALOGUE.splice(i, 1);
    } else if (i > -1 && typeof o.featured === "boolean") {
      CATALOGUE[i].featured = o.featured;
    }
  });
})();

/* ---------- Resolve local files (uploaded from gallery/PC) to playable URLs ---------- */
const mediaReady = (async () => {
  if (typeof CATALOGUE === "undefined") return;
  const local = CATALOGUE.filter((v) => v.hasMedia && !v.src);
  await Promise.all(local.map(async (v) => {
    try {
      const url = await MediaStore.getURL(v.id);
      if (url) v.src = url;
    } catch (e) { /* leave src empty */ }
  }));
})();
window.mediaReady = mediaReady;

/* ---------- On every page: nav, login gate, subscription access ---------- */
function enforceAccess() {
  const u = Auth.current();
  if (u && u.role !== "admin" && !Subs.isActive(u.email)) {
    showSubscribeWall();
    return true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  if (!Auth.current()) {
    openAuthGate({ tab: "login", force: true });
    return;
  }
  // Admins manage access; everyone else needs an active subscription
  enforceAccess();
});
