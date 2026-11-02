/* ============================================================
   StreamVibe - Home page logic
   Hero rotation, search, category filters, recommendations
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  /* ---------- Hero (auto-rotating featured titles) ---------- */
  const featured = CATALOGUE.filter((v) => v.featured);
  let heroIndex = 0;

  function showHero(video) {
    $("heroBg").style.backgroundImage =
      `linear-gradient(90deg, rgba(10,10,18,.95) 20%, rgba(10,10,18,.35)), url(${video.thumb})`;
    $("heroTitle").textContent = video.title;
    $("heroDesc").textContent = video.desc;
    $("heroTag").textContent = video.isLive ? "● LIVE NOW" : "FEATURED";
    $("heroTag").classList.toggle("live-tag", !!video.isLive);
    $("heroMeta").innerHTML =
      `<span class="badge rating">${video.rating}</span> ${video.year} • ${video.genre} • ${video.duration} • ${video.views} views`;
    $("heroPlay").href = `watch.html?id=${video.id}`;
    const wl = $("heroWl");
    wl.dataset.id = video.id;
    const inList = Watchlist.has(video.id);
    wl.innerHTML = inList ? "✓ In List" : "+ Watchlist";
    wl.classList.toggle("active", inList);

    [...$("heroDots").children].forEach((d, i) =>
      d.classList.toggle("active", i === heroIndex));
  }

  if (featured.length) {
    $("heroDots").innerHTML = featured
      .map((_, i) => `<button class="dot" data-i="${i}" aria-label="Slide ${i + 1}"></button>`)
      .join("");
    $("heroDots").addEventListener("click", (e) => {
      const d = e.target.closest(".dot");
      if (!d) return;
      heroIndex = +d.dataset.i;
      showHero(featured[heroIndex]);
    });
    showHero(featured[0]);
    setInterval(() => {
      heroIndex = (heroIndex + 1) % featured.length;
      showHero(featured[heroIndex]);
    }, 7000);
  }

  /* ---------- Category filter + search ---------- */
  let activeCat = "All";
  let query = "";

  function matches(v) {
    const inCat = activeCat === "All" || v.category === activeCat;
    const q = query.trim().toLowerCase();
    const inQuery = !q ||
      v.title.toLowerCase().includes(q) ||
      v.genre.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.desc.toLowerCase().includes(q);
    return inCat && inQuery;
  }

  function renderGrid() {
    const list = CATALOGUE.filter(matches);
    renderRow($("grid"), list, "");
    $("noResults").hidden = list.length > 0;
  }

  $("chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    activeCat = chip.dataset.cat;
    [...$("chips").children].forEach((c) => c.classList.toggle("active", c === chip));
    renderGrid();
  });

  $("searchInput").addEventListener("input", (e) => {
    query = e.target.value;
    renderGrid();
    document.getElementById("browse").scrollIntoView({ behavior: "smooth" });
  });

  renderGrid();

  /* ---------- Static rows ---------- */
  renderRow($("trendingRow"), CATALOGUE.filter((v) => v.trending).slice(0, 6));
  renderRow($("liveRow"), CATALOGUE.filter((v) => v.isLive));

  /* ---------- Personalised recommendations ---------- */
  function recommendations() {
    const history = History.all();
    const watchlist = Watchlist.all();
    const seenOrSaved = new Set([...history, ...watchlist]);

    // Genre affinity from watch history
    const affinity = {};
    history.forEach((id) => {
      const v = CATALOGUE.find((x) => x.id === id);
      if (v) affinity[v.genre] = (affinity[v.genre] || 0) + 2;
    });
    // Watchlist genres count a little too
    watchlist.forEach((id) => {
      const v = CATALOGUE.find((x) => x.id === id);
      if (v) affinity[v.genre] = (affinity[v.genre] || 0) + 1;
    });

    let picks;
    if (Object.keys(affinity).length === 0) {
      picks = CATALOGUE.filter((v) => v.trending);
      $("recoNote").textContent = "Popular picks to get you started — watch something and these will personalise.";
    } else {
      picks = CATALOGUE
        .filter((v) => !seenOrSaved.has(v.id))
        .map((v) => ({ v, score: (affinity[v.genre] || 0) + (v.trending ? 0.5 : 0) }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.v);
      const topGenre = Object.entries(affinity).sort((a, b) => b[1] - a[1])[0][0];
      $("recoNote").textContent = `Because you watched ${topGenre} titles.`;
      if (!picks.length) {
        picks = CATALOGUE.filter((v) => v.trending);
        $("recoNote").textContent = "You've seen everything we have — here's what's trending.";
      }
    }
    renderRow($("recoRow"), picks.slice(0, 6));
  }
  recommendations();
  // Refresh recommendations when returning from a watch page
  window.addEventListener("pageshow", recommendations);

  /* ---------- Subscription plans ---------- */
  const plans = Store.get("sv_plans", DEFAULT_PLANS);
  const user = Auth.current();
  const currentPlan = user && user.role !== "admin" ? Subs.plan(user.email) : null;
  $("planGrid").innerHTML = plans
    .filter((p) => p.active)
    .map((p, i) => `
      <div class="plan-card ${i === 1 ? "plan-pop" : ""}">
        ${i === 1 ? '<span class="plan-flag">MOST POPULAR</span>' : ""}
        <h3>${p.name}</h3>
        <p class="plan-price">${p.price}</p>
        <ul>
          <li>Unlimited browsing</li>
          <li>${p.id === "basic" ? "HD (720p)" : p.id === "standard" ? "Full HD (1080p)" : "4K + HDR"}</li>
          <li>${p.id === "premium" ? "4 screens" : p.id === "standard" ? "2 screens" : "1 screen"}</li>
          <li>${p.id === "basic" ? "With ads" : "Ad-free"}</li>
          <li>${p.id === "premium" ? "Downloads + parental controls" : "Parental controls"}</li>
        </ul>
        <button class="btn ${i === 1 ? "btn-primary" : "btn-ghost"} plan-btn" data-plan="${p.name}">
          ${!user ? "Sign up" : currentPlan === p.name ? "✓ Current plan" : "Subscribe"}
        </button>
      </div>`)
    .join("");

  $("planGrid").addEventListener("click", (e) => {
    const btn = e.target.closest(".plan-btn");
    if (!btn) return;
    const u = Auth.current();
    if (!u) {
      openLogin();
      return;
    }
    if (u.role === "admin") {
      showToast("Administrators don't need a subscription");
      return;
    }
    Subs.activate(u.email, btn.dataset.plan);
    showToast(`Subscribed to ${btn.dataset.plan} plan 🎉`);
    $("planGrid").querySelectorAll(".plan-btn").forEach((b) => {
      b.textContent = b.dataset.plan === btn.dataset.plan ? "✓ Current plan" : "Subscribe";
    });
  });
});
