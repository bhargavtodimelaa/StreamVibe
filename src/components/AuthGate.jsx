/* Login / signup gate modal (was openAuthGate in common.js) */
import { useEffect, useRef, useState } from "react";
import { Auth } from "../lib/store.js";
import { useApp } from "../context.jsx";

export default function AuthGate({ force, initialTab = "login" }) {
  const { refresh, showToast, setSignupOpen } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [err, setErr] = useState("");
  const firstRef = useRef(null);

  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { firstRef.current?.focus(); }, [tab]);

  const done = (user) => {
    setSignupOpen(false);
    refresh();
    showToast(`Welcome, ${user.name} (${user.role})`);
  };

  const submitLogin = (e) => {
    e.preventDefault();
    const f = e.target;
    const res = Auth.login(f.email.value, f.pass.value);
    if (!res.ok) { setErr(res.msg); return; }
    done(res.user);
  };

  const submitSignup = (e) => {
    e.preventDefault();
    const f = e.target;
    const res = Auth.signup(f.name.value, f.email.value, f.pass.value, f.role.value);
    if (!res.ok) { setErr(res.msg); return; }
    done(res.user);
  };

  const backdrop = (e) => {
    if (e.target === e.currentTarget && !force) setSignupOpen(false);
  };

  return (
    <div className="modal-backdrop open" onClick={backdrop}>
      <div className="modal">
        <h2>👋 Welcome to StreamVibe</h2>
        <p className="muted">Log in or sign up to continue.</p>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === "login" ? " active" : ""}`} onClick={() => { setTab("login"); setErr(""); }}>Log in</button>
          <button className={`auth-tab${tab === "signup" ? " active" : ""}`} onClick={() => { setTab("signup"); setErr(""); }}>Sign up</button>
        </div>

        {tab === "login" ? (
          <form onSubmit={submitLogin}>
            <label>Email
              <input type="email" name="email" defaultValue="demo@streamvibe.com" autoComplete="email" ref={firstRef} />
            </label>
            <label>Password
              <input type="password" name="pass" defaultValue="demo123" autoComplete="current-password" />
            </label>
            {err && <p className="error">{err}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Log in</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitSignup}>
            <label>Name
              <input type="text" name="name" placeholder="Your name" ref={firstRef} />
            </label>
            <label>Email
              <input type="email" name="email" placeholder="you@example.com" />
            </label>
            <label>Password
              <input type="password" name="pass" placeholder="Choose a password" />
            </label>
            <label>Role
              <select name="role" defaultValue="viewer">
                <option value="viewer">Viewer</option>
                <option value="creator">Content creator</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            {err && <p className="error">{err}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create account</button>
            </div>
          </form>
        )}

        <div className="hint-box">
          💡 Demo accounts (stored in localStorage)<br />
          Viewer: <strong>demo@streamvibe.com / demo123</strong><br />
          Creator: <strong>creator@streamvibe.com / demo123</strong><br />
          Admin: <strong>admin@streamvibe.com / admin123</strong>
        </div>
      </div>
    </div>
  );
}
