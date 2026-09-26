/* ============================================================
   StreamVibe - Admin dashboard
   Stats, upload review, content management, users, plans
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  /* ---------- Admin gate: login/signup first, then admin role ---------- */
  if (!Auth.current() || !isAdmin()) {
    const hide = () => {
      const main = document.querySelector("main");
      const footer = document.querySelector(".footer");
      if (main) main.style.display = "none";
      if (footer) footer.style.display = "none";
      document.title = "Admin sign-in — StreamVibe";
    };
    hide();

    if (!Auth.current()) {
      // no session yet -> force the shared login/signup gate (localStorage)
      openAuthGate({
        tab: "login",
        force: true,
        onSuccess: () => {
          if (isAdmin()) location.reload();
          else openAdminLogin(() => location.reload());
        }
      });
    } else {
      // signed in, but not an admin -> admin credential check
      openAdminLogin(() => location.reload());
    }
    return;
  }

  /* ---------- Stats ---------- */
  function renderStats() {
    const uploads = Store.get("sv_uploads", []);
    const subs = Store.get("sv_plans", DEFAULT_PLANS).filter((p) => p.active);
    const totalSubs = subs.reduce((s, p) => s + p.subscribers, 0);

    const stats = [
      { label: "Titles in catalogue", value: CATALOGUE.length, icon: "🎬" },
      { label: "Live streams", value: CATALOGUE.filter((v) => v.isLive).length, icon: "📡" },
      { label: "Pending review", value: uploads.filter((u) => u.status === "Pending review").length, icon: "📝" },
      { label: "PIN-protected titles", value: Object.keys(Parental.protectedMap()).length, icon: "🔒" },
      { label: "Active subscriptions", value: Subs.activeCount(allUserRows().map((u) => u.email)), icon: "✅" },
      { label: "Subscribers", value: totalSubs.toLocaleString(), icon: "👥" },
      { label: "Active plans", value: subs.length, icon: "💳" },
      { label: "Registered users", value: USERS.length, icon: "🪪" }
    ];

    $("statGrid").innerHTML = stats.map((s) => `
      <div class="stat-card">
        <span class="stat-icon">${s.icon}</span>
        <strong>${s.value}</strong>
        <span>${s.label}</span>
      </div>`).join("");
  }

  /* ---------- Upload review queue ---------- */
  function renderReview() {
    const uploads = Store.get("sv_uploads", []);
    const pending = uploads.filter((u) => u.status === "Pending review");
    $("reviewEmpty").hidden = pending.length > 0;

    $("reviewList").innerHTML = pending.map((u) => `
      <div class="review-item" data-id="${u.id}">
        <img src="${u.thumb}" alt="">
        <div class="upload-info">
          <h4>${u.title}</h4>
          <p class="card-meta">${u.category} • ${u.genre} • rated ${u.rating}</p>
        </div>
        <div class="upload-actions">
          <button class="btn btn-mini btn-primary approve-btn" data-id="${u.id}">Approve</button>
          <button class="btn btn-mini btn-ghost reject-btn" data-id="${u.id}">Reject</button>
        </div>
      </div>`).join("");
  }

  $("reviewList").addEventListener("click", (e) => {
    const approve = e.target.closest(".approve-btn");
    const reject = e.target.closest(".reject-btn");
    if (!approve && !reject) return;
    const id = (approve || reject).dataset.id;

    let uploads = Store.get("sv_uploads", []);
    let extra = Store.get("sv_extra_videos", []);

    if (approve) {
      // keep it in the creator's list, just mark it published
      uploads = uploads.map((u) => (u.id === id ? { ...u, status: "Published" } : u));
      extra = extra.map((v) => (v.id === id ? { ...v, status: "Published" } : v));
      const inCat = CATALOGUE.find((v) => v.id === id);
      if (inCat) inCat.status = "Published";
      showToast("Upload approved and published ✓");
    } else {
      // rejected: drop it everywhere so it can't be played
      uploads = uploads.filter((u) => u.id !== id);
      extra = extra.filter((v) => v.id !== id);
      const i = CATALOGUE.findIndex((v) => v.id === id);
      if (i > -1) CATALOGUE.splice(i, 1);
      Parental.setProtected(id, false);
      MediaStore.remove(id);
      showToast("Upload rejected and removed");
    }
    Store.set("sv_uploads", uploads);
    Store.set("sv_extra_videos", extra);

    renderReview();
    renderStats();
    renderContent($("adminSearch").value);
  });

  /* ---------- Content management ---------- */
  function renderContent(filter = "") {
    const extra = Store.get("sv_extra_videos", []);
    const all = [...CATALOGUE, ...extra.filter((e) => !CATALOGUE.find((c) => c.id === e.id))];
    const q = filter.trim().toLowerCase();
    const rows = all.filter((v) => !q || v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q));

    $("contentEmpty").hidden = rows.length > 0;
    $("contentTable").querySelector("tbody").innerHTML = rows.map((v) => `
      <tr data-id="${v.id}">
        <td><a href="watch.html?id=${v.id}">${v.title}</a></td>
        <td>${v.category}</td>
        <td><span class="badge rating">${v.rating}</span></td>
        <td>${v.year}</td>
        <td>${typeof v.views === "number" ? v.views.toLocaleString() : v.views}</td>
        <td>${[v.featured ? "⭐ Featured" : "", v.trending ? "🔥 Trending" : "", v.isLive ? "● Live" : ""]
              .filter(Boolean).join(" ") || "—"}</td>
        <td>
          <button class="btn btn-mini ${Parental.isProtected(v) ? "btn-primary" : "btn-ghost"} prot-btn" data-id="${v.id}">
            ${Parental.isProtected(v) ? "🔒 PIN" : "🔓 Open"}
          </button>
        </td>
        <td class="row-actions">
          <button class="btn btn-mini btn-ghost feat-btn" data-id="${v.id}">${v.featured ? "Unfeature" : "Feature"}</button>
          <button class="btn btn-mini btn-ghost del-content" data-id="${v.id}">Remove</button>
        </td>
      </tr>`).join("");
  }

  function findVideo(id) {
    const extra = Store.get("sv_extra_videos", []);
    return CATALOGUE.find((v) => v.id === id) || extra.find((v) => v.id === id);
  }

  $("contentTable").addEventListener("click", (e) => {
    const feat = e.target.closest(".feat-btn");
    const del = e.target.closest(".del-content");
    const prot = e.target.closest(".prot-btn");

    if (prot) {
      const v = findVideo(prot.dataset.id);
      if (!v) return;
      const nowProtected = !Parental.isProtected(v);
      Parental.setProtected(v.id, nowProtected);
      renderContent($("adminSearch").value);
      renderStats();
      showToast(nowProtected
        ? `🔒 "${v.title}" now asks for the PIN (${Parental.pin()}) before playing`
        : `🔓 "${v.title}" now plays directly`);
    }

    if (feat) {
      const v = findVideo(feat.dataset.id);
      if (!v) return;
      v.featured = !v.featured;
      // persist for built-in titles too (survives reload)
      const ov = Store.get("sv_video_overrides", {});
      ov[v.id] = { ...(ov[v.id] || {}), featured: v.featured };
      Store.set("sv_video_overrides", ov);
      Store.set("sv_extra_videos", Store.get("sv_extra_videos", [])
        .map((x) => (x.id === v.id ? { ...x, featured: v.featured } : x)));
      renderContent($("adminSearch").value);
      showToast(v.featured ? `"${v.title}" added to Featured` : `"${v.title}" removed from Featured`);
    }

    if (del) {
      const v = findVideo(del.dataset.id);
      if (!v) return;
      if (!confirm(`Remove "${v.title}" from the platform?`)) return;
      const i = CATALOGUE.indexOf(v);
      if (i > -1) CATALOGUE.splice(i, 1);
      Store.set("sv_extra_videos", Store.get("sv_extra_videos", []).filter((x) => x.id !== v.id));
      let uploads = Store.get("sv_uploads", []).filter((x) => x.id !== v.id);
      Store.set("sv_uploads", uploads);
      // persist the removal for built-in titles too (survives reload)
      const ov = Store.get("sv_video_overrides", {});
      ov[v.id] = { ...(ov[v.id] || {}), removed: true };
      Store.set("sv_video_overrides", ov);
      Parental.setProtected(v.id, false);            // drop its parental setting
      MediaStore.remove(v.id);                       // drop its stored local file
      localStorage.removeItem("sv_progress_" + v.id);
      renderContent($("adminSearch").value);
      renderStats();
      renderReview();
      showToast(`"${v.title}" removed`);
    }
  });

  $("adminSearch").addEventListener("input", (e) => renderContent(e.target.value));

  /* ---------- Users & subscriptions ---------- */
  function allUserRows() {
    const rows = USERS.map((u) => ({ name: u.name, email: u.email, joined: u.joined }));
    Auth.users().forEach((a) => {
      if (!rows.some((r) => r.email === a.email)) {
        rows.push({ name: a.name, email: a.email, joined: "(registered on this site)" });
      }
    });
    return rows;
  }

  function renderUsers() {
    const planNames = Store.get("sv_plans", DEFAULT_PLANS).map((p) => p.name);
    $("userTable").querySelector("tbody").innerHTML = allUserRows().map((u) => {
      const sub = Subs.forUser(u.email);
      const active = sub.status === "active";
      const isAdminUser = Auth.users().some((a) => a.email === u.email && a.role === "admin");
      return `
        <tr>
          <td>${u.name}${isAdminUser ? " 🛡" : ""}</td>
          <td>${u.email}</td>
          <td>
            <select class="plan-pick" data-email="${u.email}" ${isAdminUser ? "disabled" : ""}>
              ${planNames.map((p) => `<option ${p === sub.plan ? "selected" : ""}>${p}</option>`).join("")}
            </select>
          </td>
          <td><span class="status ${active ? "active" : "deactivated"}">${active ? "Active" : "Deactivated"}</span></td>
          <td>${u.joined}</td>
          <td class="row-actions">
            <button class="btn btn-mini ${active ? "btn-ghost" : "btn-primary"} suspend-btn" data-email="${u.email}"
              ${isAdminUser ? "disabled title=\"Admins always keep access\"" : ""}>
              ${active ? "Deactivate" : "Grant access"}
            </button>
          </td>
        </tr>`;
    }).join("");
  }

  $("userTable").addEventListener("click", (e) => {
    const btn = e.target.closest(".suspend-btn");
    if (!btn || btn.disabled) return;
    const email = btn.dataset.email;
    const active = Subs.isActive(email);
    if (active) {
      Subs.deactivate(email);
      showToast(`⛔ ${email} deactivated — they must pick a plan to watch again`);
    } else {
      Subs.activate(email);
      showToast(`✅ ${email} granted access`);
    }
    renderUsers();
    renderStats();
  });

  $("userTable").addEventListener("change", (e) => {
    const sel = e.target.closest(".plan-pick");
    if (!sel) return;
    Subs.set(sel.dataset.email, { plan: sel.value });
    showToast(`💳 ${sel.dataset.email} → ${sel.value} plan`);
  });

  /* ---------- Parental PIN settings ---------- */
  function renderPin() {
    const el = $("currentPin");
    if (el) el.textContent = Parental.isPinDefault() ? "1234 (default)" : Parental.pin();
  }

  $("savePinBtn").addEventListener("click", () => {
    const p1 = $("newPinInput").value.trim();
    const p2 = $("newPinInput2").value.trim();
    const err = $("pinErr");
    if (!/^\d{4,6}$/.test(p1)) {
      err.textContent = "PIN must be 4–6 digits.";
      err.hidden = false;
      return;
    }
    if (p1 !== p2) {
      err.textContent = "The two PINs do not match.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    Parental.setPin(p1);
    $("newPinInput").value = "";
    $("newPinInput2").value = "";
    renderPin();
    showToast(`🔐 Custom parental PIN saved — ${p1}`);
  });

  $("resetPinBtn").addEventListener("click", () => {
    Parental.resetPin();
    renderPin();
    showToast("PIN reset to default 1234");
  });

  /* ---------- Plans ---------- */
  function renderPlans() {
    const plans = Store.get("sv_plans", DEFAULT_PLANS);
    $("planAdmin").innerHTML = plans.map((p) => `
      <div class="plan-card ${p.active ? "" : "plan-off"}">
        <h3>${p.name}</h3>
        <p class="plan-price">${p.price}</p>
        <p class="muted">${p.subscribers.toLocaleString()} subscribers</p>
        <button class="btn ${p.active ? "btn-ghost" : "btn-primary"} toggle-plan" data-id="${p.id}">
          ${p.active ? "Deactivate" : "Activate"}
        </button>
      </div>`).join("");
  }

  $("planAdmin").addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-plan");
    if (!btn) return;
    const plans = Store.get("sv_plans", DEFAULT_PLANS);
    const p = plans.find((x) => x.id === btn.dataset.id);
    p.active = !p.active;
    Store.set("sv_plans", plans);
    renderPlans();
    renderStats();
    showToast(`${p.name} plan ${p.active ? "activated" : "deactivated"}`);
  });

  /* ---------- Init ---------- */
  renderStats();
  renderReview();
  renderContent();
  renderUsers();
  renderPlans();
  renderPin();
});
