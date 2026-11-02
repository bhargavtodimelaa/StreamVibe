/* Admin sign-in modal (was openAdminLogin in common.js) */
import { useState } from "react";
import { Auth, DEMO_ADMIN_EMAIL } from "../lib/store.js";
import { useApp } from "../context.jsx";

export default function AdminLogin() {
  const { refresh, showToast, setSignupOpen } = useApp();
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const f = e.target;
    const user = Auth.verify(f.email.value, f.pass.value);
    if (!user) { setErr("Wrong email or password."); return; }
    if (user.role !== "admin") { setErr("This account is not an administrator."); return; }
    Auth.setSession(user);
    refresh();
    showToast("Signed in as Administrator 🛡");
  };

  return (
    <div className="modal-backdrop open">
      <div className="modal modal-sm">
        <h2>🛡 Admin sign-in</h2>
        <p className="muted">This area is restricted to administrators.</p>
        <div className="hint-box">
          💡 Demo admin account (from localStorage)<br />
          Email: <strong>{DEMO_ADMIN_EMAIL}</strong><br />
          Password: <strong>admin123</strong>
        </div>
        <form onSubmit={submit}>
          <label>Email
            <input type="email" name="email" defaultValue={DEMO_ADMIN_EMAIL} autoFocus />
          </label>
          <label>Password
            <input type="password" name="pass" placeholder="Password" />
          </label>
          {err && <p className="error">{err}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSignupOpen(true)}>Sign up instead</button>
            <button type="submit" className="btn btn-primary">Sign in as admin</button>
          </div>
        </form>
      </div>
    </div>
  );
}
