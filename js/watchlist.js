/* ============================================================
   StreamVibe - My List page (watchlist, history, parental)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  function byIds(ids) {
    return ids.map((id) => CATALOGUE.find((v) => v.id === id)).filter(Boolean);
  }

  function renderAll() {
    const wl = byIds(Watchlist.all());
    renderRow($("wlGrid"), wl, "");
    $("wlEmpty").hidden = wl.length > 0;
    $("wlCount").textContent = wl.length;

    const hist = byIds(History.all());
    renderRow($("histGrid"), hist, "");
    $("histEmpty").hidden = hist.length > 0;

    // Progress bars on history cards
    hist.forEach((v) => {
      const p = Progress.get(v.id);
      if (p > 5) {
        const card = $("histGrid").querySelector(`[data-id="${v.id}"] .card-media`);
        if (card && !card.querySelector(".progress")) {
          const bar = document.createElement("div");
          bar.className = "progress";
          bar.innerHTML = `<span style="width:${Math.min(100, p / 8)}%"></span>`;
          card.appendChild(bar);
        }
      }
    });
  }

  renderAll();

  $("clearWl").addEventListener("click", () => {
    Watchlist.clear();
    renderAll();
    showToast("Watchlist cleared");
  });

  $("clearHist").addEventListener("click", () => {
    History.clear();
    renderAll();
    showToast("History cleared");
  });

  /* ---------- Parental controls panel ---------- */
  function renderParental() {
    const prot = Parental.protectedVideos();
    $("protectedList").innerHTML = prot.length
      ? prot.map((v) => `<li>🔒 <a href="watch.html?id=${v.id}">${v.title}</a></li>`).join("")
      : '<li class="muted">No protected titles yet — an admin can toggle “Parental” per video in the admin panel.</li>';
    $("pinStatus").textContent = Parental.isPinDefault()
      ? "1234 (demo default)"
      : "set by you";
  }
  renderParental();

  $("changePin").addEventListener("click", () => {
    let modal = document.getElementById("pinModal");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "pinModal";
    modal.className = "modal-backdrop open";
    modal.innerHTML = `
      <div class="modal modal-sm">
        <h2>Set parental PIN</h2>
        <p class="muted">4–6 digits. You'll be asked for it to play restricted titles.</p>
        <input type="password" id="newPin" inputmode="numeric" maxlength="6" placeholder="New PIN">
        <div class="modal-actions">
          <button class="btn btn-ghost" id="pinCancel">Cancel</button>
          <button class="btn btn-primary" id="pinSave">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#newPin").focus();
    modal.querySelector("#pinCancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#pinSave").addEventListener("click", () => {
      const val = modal.querySelector("#newPin").value.trim();
      if (val.length < 4) { showToast("PIN must be at least 4 digits"); return; }
      Parental.setPin(val);
      modal.remove();
      renderParental();
      showToast("PIN updated");
    });
  });

  $("resetParental").addEventListener("click", () => {
    Parental.resetAll();
    renderParental();
    renderAll();
    showToast("PIN reset to 1234 and all protections cleared");
  });
});
