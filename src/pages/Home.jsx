/* Home page (was app.js): hero carousel, search, filters, recommendations, plans */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { getCatalogue } from "../lib/catalogue.js";
import { History, Store, Subs, Watchlist } from "../lib/store.js";
import { DEFAULT_PLANS, CATEGORIES } from "../data.js";
import VideoRow from "../components/VideoRow.jsx";

export default function Home() {
  const { version, refresh, showToast, search, setSignupOpen, user } = useApp();
  const catalogue = useMemo(() => getCatalogue(), [version]);

  const [activeCat, setActiveCat] = useState("All");
  const [heroIndex, setHeroIndex] = useState(0);
  const browseRef = useRef(null);
  const firstSearch = useRef(true);

  useEffect(() => { document.title = "StreamVibe — Movies, Shows & Live Streams"; }, []);

  /* ---------- Hero (auto-rotating featured titles) ---------- */
  const featured = useMemo(() => catalogue.filter((v) => v.featured), [catalogue]);
  useEffect(() => {
    if (featured.length < 2) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % featured.length), 7000);
    return () => clearInterval(t);
  }, [featured.length]);
  const hero = featured.length ? featured[heroIndex % featured.length] : null;

  /* ---------- Category filter + search ---------- */
  useEffect(() => {
    if (firstSearch.current) { firstSearch.current = false; return; }
    browseRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [search]);

  const matches = (v) => {
    const inCat = activeCat === "All" || v.category === activeCat;
    const q = search.trim().toLowerCase();
    const inQuery = !q ||
      v.title.toLowerCase().includes(q) ||
      v.genre.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.desc.toLowerCase().includes(q);
    return inCat && inQuery;
  };
  const gridList = catalogue.filter(matches);

  /* ---------- Personalised recommendations ---------- */
  const reco = useMemo(() => {
    const history = History.all();
    const watchlist = Watchlist.all();
    const seenOrSaved = new Set([...history, ...watchlist]);

    const affinity = {};
    history.forEach((id) => {
      const v = catalogue.find((x) => x.id === id);
      if (v) affinity[v.genre] = (affinity[v.genre] || 0) + 2;
    });
    watchlist.forEach((id) => {
      const v = catalogue.find((x) => x.id === id);
      if (v) affinity[v.genre] = (affinity[v.genre] || 0) + 1;
    });

    let picks, note;
    if (Object.keys(affinity).length === 0) {
      picks = catalogue.filter((v) => v.trending);
      note = "Popular picks to get you started — watch something and these will personalise.";
    } else {
      picks = catalogue
        .filter((v) => !seenOrSaved.has(v.id))
        .map((v) => ({ v, score: (affinity[v.genre] || 0) + (v.trending ? 0.5 : 0) }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.v);
      const topGenre = Object.entries(affinity).sort((a, b) => b[1] - a[1])[0][0];
      note = `Because you watched ${topGenre} titles.`;
      if (!picks.length) {
        picks = catalogue.filter((v) => v.trending);
        note = "You've seen everything we have — here's what's trending.";
      }
    }
    return { picks: picks.slice(0, 6), note };
  }, [catalogue, version]);

  /* ---------- Subscription plans ---------- */
  const plans = Store.get("sv_plans", DEFAULT_PLANS).filter((p) => p.active);
  const currentPlan = user && user.role !== "admin" ? Subs.plan(user.email) : null;

  const subscribe = (name) => {
    if (!user) { setSignupOpen(false); return; }
    if (user.role === "admin") {
      showToast("Administrators don't need a subscription");
      return;
    }
    Subs.activate(user.email, name);
    refresh();
    showToast(`Subscribed to ${name} plan 🎉`);
  };

  return (
    <>
      {/* HERO */}
      {hero && (
        <section className="hero">
          <div
            className="hero-bg"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(10,10,18,.95) 20%, rgba(10,10,18,.35)), url(${hero.thumb})`
            }}
          />
          <div className="hero-content">
            <span className={`hero-tag${hero.isLive ? " live-tag" : ""}`}>
              {hero.isLive ? "● LIVE NOW" : "FEATURED"}
            </span>
            <h1>{hero.title}</h1>
            <p>{hero.desc}</p>
            <div className="hero-meta">
              <span className="badge rating">{hero.rating}</span> {hero.year} • {hero.genre} • {hero.duration} • {hero.views} views
            </div>
            <div className="hero-btns">
              <Link className="btn btn-primary" to={`/watch?id=${hero.id}`}>▶ Play</Link>
              <HeroWlBtn videoId={hero.id} />
            </div>
            <div className="hero-dots">
              {featured.map((_, i) => (
                <button
                  key={featured[i].id}
                  className={`dot${i === heroIndex % featured.length ? " active" : ""}`}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setHeroIndex(i)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CATEGORIES / BROWSE */}
      <main id="browse" ref={browseRef}>
        <section className="section">
          <div className="section-head">
            <h2>Browse by category</h2>
          </div>
          <div className="chips">
            {["All", ...CATEGORIES].map((c) => (
              <button
                key={c}
                className={`chip${activeCat === c ? " active" : ""}`}
                onClick={() => setActiveCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <VideoRow videos={gridList} emptyMsg="" className="grid" />
          {gridList.length === 0 && <p className="empty">No titles match your search.</p>}
        </section>

        <section className="section">
          <div className="section-head"><h2>🔥 Trending now</h2></div>
          <VideoRow videos={catalogue.filter((v) => v.trending).slice(0, 6)} />
        </section>

        <section className="section">
          <div className="section-head"><h2>✨ Recommended for you</h2></div>
          <p className="muted">{reco.note}</p>
          <VideoRow videos={reco.picks} />
        </section>

        <section className="section">
          <div className="section-head"><h2>📡 Live now</h2></div>
          <VideoRow videos={catalogue.filter((v) => v.isLive)} />
        </section>

        {/* SUBSCRIPTION PLANS */}
        <section className="section plans">
          <div className="section-head"><h2>Choose your plan</h2></div>
          <div className="plan-grid">
            {plans.map((p, i) => (
              <div key={p.id} className={`plan-card${i === 1 ? " plan-pop" : ""}`}>
                {i === 1 && <span className="plan-flag">MOST POPULAR</span>}
                <h3>{p.name}</h3>
                <p className="plan-price">{p.price}</p>
                <ul>
                  <li>Unlimited browsing</li>
                  <li>{p.id === "basic" ? "HD (720p)" : p.id === "standard" ? "Full HD (1080p)" : "4K + HDR"}</li>
                  <li>{p.id === "premium" ? "4 screens" : p.id === "standard" ? "2 screens" : "1 screen"}</li>
                  <li>{p.id === "basic" ? "With ads" : "Ad-free"}</li>
                  <li>{p.id === "premium" ? "Downloads + parental controls" : "Parental controls"}</li>
                </ul>
                <button
                  className={`btn ${i === 1 ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => subscribe(p.name)}
                >
                  {!user ? "Sign up" : currentPlan === p.name ? "✓ Current plan" : "Subscribe"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>StreamVibe — FEDF course project. Demo content from public test streams.</p>
        <p className="muted">Movies • TV Shows • Live • Documentaries • Kids</p>
      </footer>
    </>
  );
}

function HeroWlBtn({ videoId }) {
  const { version, refresh, showToast } = useApp();
  const inList = Watchlist.has(videoId) && version >= 0;
  const toggle = () => {
    const added = Watchlist.toggle(videoId);
    refresh();
    showToast(added ? "Added to your watchlist" : "Removed from watchlist");
  };
  return (
    <button className={`btn btn-ghost wl-btn${inList ? " active" : ""}`} onClick={toggle}>
      {inList ? "✓ In List" : "+ Watchlist"}
    </button>
  );
}
