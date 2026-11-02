/* ============================================================
   StreamVibe - Shared logic (storage, watchlist,
   watch history, parental controls, localStorage auth)
   ============================================================ */

export const Store = {
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
export const Watchlist = {
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
export const History = {
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
export const Progress = {
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

export const Parental = {
  DEMO_PIN: "1234",                          // default PIN for all videos

  protectedMap() { return Store.get("sv_video_parental", {}); },
  isProtected(video) { return !!this.protectedMap()[video.id]; },
  setProtected(id, on) {
    const map = this.protectedMap();
    if (on) map[id] = true;
    else delete map[id];
    Store.set("sv_video_parental", map);
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
  relock(id) { sessionUnlocked.delete(id); },         // leaving the page view

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
export const MediaStore = (() => {
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
export const Auth = {
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
export const Subs = {
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

export function isAdmin() {
  const u = Auth.current();
  if (!u || u.role !== "admin") return false;
  // session must match a real admin account stored in localStorage
  return Auth.users().some((x) => x.email === u.email && x.role === "admin");
}

export const DEMO_ADMIN_EMAIL = "admin@streamvibe.com";
