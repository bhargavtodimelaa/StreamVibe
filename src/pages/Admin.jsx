/* Admin dashboard (was admin.js): stats, review queue, content, users, PIN, plans */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { getCatalogue } from "../lib/catalogue.js";
import { Auth, MediaStore, Parental, Store, Subs, isAdmin } from "../lib/store.js";
import { DEFAULT_PLANS, USERS } from "../data.js";
import AdminLogin from "../components/AdminLogin.jsx";

export default function Admin() {
  const { version, refresh, showToast, user, signupOpen, setSignupOpen } = useApp();
  const [filter, setFilter] = useState("");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinErr, setPinErr] = useState("");
  const allowed = !!user && isAdmin();

  useEffect(() => {
    document.title = allowed ? "Admin — StreamVibe" : "Admin sign-in — StreamVibe";
  }, [allowed]);

  const catalogue = useMemo(() => getCatalogue(), [version]);
  const uploads = Store.get("sv_uploads", []);
  const plans = Store.get("sv_plans", DEFAULT_PLANS);
  const subs = plans.filter((p) => p.active);
  const totalSubs = subs.reduce((s, p) => s + p.subscribers, 0);
  void version;

  const allUserRows = () => {
    const rows = USERS.map((u) => ({ name: u.name, email: u.email, joined: u.joined }));
    Auth.users().forEach((a) => {
      if (!rows.some((r) => r.email === a.email)) {
        rows.push({ name: a.name, email: a.email, joined: "(registered on this site)" });
      }
    });
    return rows;
  };

  if (!allowed) {
    // signed in but not an admin -> admin credential check; no session -> shared auth gate
    return user && !signupOpen ? <AdminLogin /> : null;
  }

  return <AdminPanel
    catalogue={catalogue}
    uploads={uploads}
    plans={plans}
    subs={subs}
    totalSubs={totalSubs}
    allUserRows={allUserRows}
    filter={filter}
    setFilter={setFilter}
    pin1={pin1} setPin1={setPin1}
    pin2={pin2} setPin2={setPin2}
    pinErr={pinErr} setPinErr={setPinErr}
    refresh={refresh}
    showToast={showToast}
  />;
}

function AdminPanel({
  catalogue, uploads, plans, subs, totalSubs, allUserRows,
  filter, setFilter, pin1, setPin1, pin2, setPin2, pinErr, setPinErr,
  refresh, showToast
}) {
  /* ---------- Stats ---------- */
  const stats = [
    { label: "Titles in catalogue", value: catalogue.length, icon: "🎬" },
    { label: "Live streams", value: catalogue.filter((v) => v.isLive).length, icon: "📡" },
    { label: "Pending review", value: uploads.filter((u) => u.status === "Pending review").length, icon: "📝" },
    { label: "PIN-protected titles", value: Object.keys(Parental.protectedMap()).length, icon: "🔒" },
    { label: "Active subscriptions", value: Subs.activeCount(allUserRows().map((u) => u.email)), icon: "✅" },
    { label: "Subscribers", value: totalSubs.toLocaleString(), icon: "👥" },
    { label: "Active plans", value: subs.length, icon: "💳" },
    { label: "Registered users", value: USERS.length, icon: "🪪" }
  ];

  const pending = uploads.filter((u) => u.status === "Pending review");

  const review = (id, approve) => {
    let up = Store.get("sv_uploads", []);
    let extra = Store.get("sv_extra_videos", []);

    if (approve) {
      up = up.map((u) => (u.id === id ? { ...u, status: "Published" } : u));
      extra = extra.map((v) => (v.id === id ? { ...v, status: "Published" } : v));
      showToast("Upload approved and published ✓");
    } else {
      up = up.filter((u) => u.id !== id);
      extra = extra.filter((v) => v.id !== id);
      Parental.setProtected(id, false);
      MediaStore.remove(id);
      showToast("Upload rejected and removed");
    }
    Store.set("sv_uploads", up);
    Store.set("sv_extra_videos", extra);
    refresh();
  };

  /* ---------- Content management ---------- */
  const q = filter.trim().toLowerCase();
  const rows = catalogue.filter((v) => !q || v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q));

  const findVideo = (id) => catalogue.find((v) => v.id === id)
    || Store.get("sv_extra_videos", []).find((v) => v.id === id);

  const toggleProtected = (id) => {
    const v = findVideo(id);
    if (!v) return;
    const nowProtected = !Parental.isProtected(v);
    Parental.setProtected(id, nowProtected);
    refresh();
    showToast(nowProtected
      ? `🔒 "${v.title}" now asks for the PIN (${Parental.pin()}) before playing`
      : `🔓 "${v.title}" now plays directly`);
  };

  const toggleFeatured = (id) => {
    const v = findVideo(id);
    if (!v) return;
    const featured = !v.featured;
    const ov = Store.get("sv_video_overrides", {});
    ov[v.id] = { ...(ov[v.id] || {}), featured };
    Store.set("sv_video_overrides", ov);
    Store.set("sv_extra_videos", Store.get("sv_extra_videos", [])
      .map((x) => (x.id === v.id ? { ...x, featured } : x)));
    refresh();
    showToast(featured ? `"${v.title}" added to Featured` : `"${v.title}" removed from Featured`);
  };

  const removeContent = (id) => {
    const v = findVideo(id);
    if (!v) return;
    if (!window.confirm(`Remove "${v.title}" from the platform?`)) return;
    Store.set("sv_extra_videos", Store.get("sv_extra_videos", []).filter((x) => x.id !== v.id));
    Store.set("sv_uploads", Store.get("sv_uploads", []).filter((x) => x.id !== v.id));
    const ov = Store.get("sv_video_overrides", {});
    ov[v.id] = { ...(ov[v.id] || {}), removed: true };
    Store.set("sv_video_overrides", ov);
    Parental.setProtected(v.id, false);
    MediaStore.remove(v.id);
    localStorage.removeItem("sv_progress_" + v.id);
    refresh();
    showToast(`"${v.title}" removed`);
  };

  /* ---------- Users & subscriptions ---------- */
  const planNames = plans.map((p) => p.name);

  const suspend = (email) => {
    if (Subs.isActive(email)) {
      Subs.deactivate(email);
      showToast(`⛔ ${email} deactivated — they must pick a plan to watch again`);
    } else {
      Subs.activate(email);
      showToast(`✅ ${email} granted access`);
    }
    refresh();
  };

  /* ---------- Parental PIN settings ---------- */
  const savePin = () => {
    if (!/^\d{4,6}$/.test(pin1)) { setPinErr("PIN must be 4–6 digits."); return; }
    if (pin1 !== pin2) { setPinErr("The two PINs do not match."); return; }
    setPinErr("");
    Parental.setPin(pin1);
    setPin1("");
    setPin2("");
    showToast(`🔐 Custom parental PIN saved — ${pin1}`);
  };

  const resetPin = () => {
    Parental.resetPin();
    showToast("PIN reset to default 1234");
  };

  /* ---------- Plans ---------- */
  const togglePlan = (id) => {
    const list = Store.get("sv_plans", DEFAULT_PLANS);
    const p = list.find((x) => x.id === id);
    p.active = !p.active;
    Store.set("sv_plans", list);
    refresh();
    showToast(`${p.name} plan ${p.active ? "activated" : "deactivated"}`);
  };

  return (
    <main className="page">
      <section className="section">
        <div className="section-head"><h2>🛡 Admin dashboard</h2></div>
        <div className="stat-grid">
          {stats.map((s) => (
            <div className="stat-card" key={s.label}>
              <span className="stat-icon">{s.icon}</span>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>📝 Uploads awaiting review</h2></div>
        <div>
          {pending.map((u) => (
            <div className="review-item" key={u.id}>
              <img src={u.thumb} alt="" />
              <div className="upload-info">
                <h4>{u.title}</h4>
                <p className="card-meta">{u.category} • {u.genre} • rated {u.rating}</p>
              </div>
              <div className="upload-actions">
                <button className="btn btn-mini btn-primary" onClick={() => review(u.id, true)}>Approve</button>
                <button className="btn btn-mini btn-ghost" onClick={() => review(u.id, false)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
        {pending.length === 0 && <p className="empty">No pending uploads.</p>}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>🎬 Content management</h2>
          <input
            type="search"
            className="search"
            placeholder="Filter titles…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th><th>Category</th><th>Rating</th><th>Year</th><th>Views</th><th>Flags</th><th>Parental</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td><Link to={`/watch?id=${v.id}`}>{v.title}</Link></td>
                  <td>{v.category}</td>
                  <td><span className="badge rating">{v.rating}</span></td>
                  <td>{v.year}</td>
                  <td>{typeof v.views === "number" ? v.views.toLocaleString() : v.views}</td>
                  <td>
                    {[v.featured ? "⭐ Featured" : "", v.trending ? "🔥 Trending" : "", v.isLive ? "● Live" : ""]
                      .filter(Boolean).join(" ") || "—"}
                  </td>
                  <td>
                    <button
                      className={`btn btn-mini ${Parental.isProtected(v) ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => toggleProtected(v.id)}
                    >
                      {Parental.isProtected(v) ? "🔒 PIN" : "🔓 Open"}
                    </button>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-mini btn-ghost" onClick={() => toggleFeatured(v.id)}>
                      {v.featured ? "Unfeature" : "Feature"}
                    </button>
                    <button className="btn btn-mini btn-ghost" onClick={() => removeContent(v.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="empty">No titles match.</p>}
      </section>

      <section className="section">
        <div className="section-head"><h2>👥 Users &amp; subscriptions</h2></div>
        <p className="muted">Deactivating a user makes them pick a plan before they can watch again.</p>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {allUserRows().map((u) => {
                const sub = Subs.forUser(u.email);
                const active = sub.status === "active";
                const adminUser = Auth.users().some((a) => a.email === u.email && a.role === "admin");
                return (
                  <tr key={u.email}>
                    <td>{u.name}{adminUser ? " 🛡" : ""}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="plan-pick"
                        disabled={adminUser}
                        value={sub.plan}
                        onChange={(e) => {
                          Subs.set(u.email, { plan: e.target.value });
                          refresh();
                          showToast(`💳 ${u.email} → ${e.target.value} plan`);
                        }}
                      >
                        {planNames.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td><span className={`status ${active ? "active" : "deactivated"}`}>{active ? "Active" : "Deactivated"}</span></td>
                    <td>{u.joined}</td>
                    <td className="row-actions">
                      <button
                        className={`btn btn-mini ${active ? "btn-ghost" : "btn-primary"}`}
                        disabled={adminUser}
                        title={adminUser ? "Admins always keep access" : undefined}
                        onClick={() => suspend(u.email)}
                      >
                        {active ? "Deactivate" : "Grant access"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>🔐 Parental PIN (all videos)</h2></div>
        <div className="panel">
          <p className="muted">
            One PIN protects every title marked <strong>🔒 PIN</strong> in the content table above.
            Current PIN: <strong>{Parental.isPinDefault() ? "1234 (default)" : Parental.pin()}</strong>
          </p>
          <div className="field-row">
            <label>Set a custom PIN (4–6 digits)
              <input type="password" inputMode="numeric" maxLength={6} placeholder="e.g. 5678"
                value={pin1} onChange={(e) => setPin1(e.target.value)} />
            </label>
            <label>Confirm PIN
              <input type="password" inputMode="numeric" maxLength={6} placeholder="repeat it"
                value={pin2} onChange={(e) => setPin2(e.target.value)} />
            </label>
          </div>
          {pinErr && <p className="error">{pinErr}</p>}
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={savePin}>Save custom PIN</button>
            <button className="btn btn-ghost" onClick={resetPin}>Reset to 1234</button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>💳 Subscription plans</h2></div>
        <div className="plan-grid">
          {plans.map((p) => (
            <div key={p.id} className={`plan-card${p.active ? "" : " plan-off"}`}>
              <h3>{p.name}</h3>
              <p className="plan-price">{p.price}</p>
              <p className="muted">{p.subscribers.toLocaleString()} subscribers</p>
              <button
                className={`btn ${p.active ? "btn-ghost" : "btn-primary"}`}
                onClick={() => togglePlan(p.id)}
              >
                {p.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer"><p>StreamVibe — FEDF course project.</p></footer>
    </main>
  );
}
