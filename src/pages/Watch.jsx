/* Watch page (was watch.js): player, HLS/quality, resume, PIN gate, up-next, related */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context.jsx";
import { getCatalogue, mediaReady } from "../lib/catalogue.js";
import { History, Parental, Progress, Watchlist } from "../lib/store.js";
import VideoRow from "../components/VideoRow.jsx";

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Watch() {
  const { version, refresh, showToast } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [mediaTick, setMediaTick] = useState(0);
  const catalogue = useMemo(() => getCatalogue(), [version, mediaTick]);
  const id = params.get("id");
  const video = catalogue.find((v) => v.id === id) || catalogue[0];

  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const saveTick = useRef(0);
  const historyAdded = useRef(false);

  const [streamInfo, setStreamInfo] = useState("");
  const [levels, setLevels] = useState([]);
  const [autoQuality, setAutoQuality] = useState(true);
  const [forcedLevel, setForcedLevel] = useState(-1);
  const [qualityLabel, setQualityLabel] = useState("Auto");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [unlockedId, setUnlockedId] = useState(null);
  const [upNext, setUpNext] = useState(null); // { video, countdown }

  /* Re-render once stored files finish resolving to playable URLs */
  useEffect(() => {
    let alive = true;
    mediaReady.then(() => { if (alive) setMediaTick((t) => t + 1); });
    return () => { alive = false; };
  }, []);

  const saved = useMemo(() => (video ? Progress.get(video.id) : 0), [video?.id]);

  const locked = !!video && Parental.isLocked(video) && unlockedId !== video.id;
  const related = useMemo(() => {
    if (!video) return [];
    const r = catalogue.filter(
      (v) => v.id !== video.id && (v.genre === video.genre || v.category === video.category)
    ).slice(0, 6);
    return r.length ? r : catalogue.filter((v) => v.id !== video.id).slice(0, 6);
  }, [catalogue, video]);

  useEffect(() => {
    if (!video) return;
    document.title = `${video.title} — StreamVibe`;
    return () => { Parental.relock(video.id); };
  }, [video?.id]);

  /* ---------- Resolve stored files, then set up the player ---------- */
  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setStreamInfo("");
    setLevels([]);
    setAutoQuality(true);
    setForcedLevel(-1);
    setQualityLabel("Auto");
    setUpNext(null);
    historyAdded.current = false;
    saveTick.current = 0;

    const playLocal = (v) => {
      const player = playerRef.current;
      if (!player || cancelled) return;
      if (v.hls) {
        const nativeHls = player.canPlayType("application/vnd.apple.mpegurl");
        if (nativeHls) {
          player.src = v.src;
          setStreamInfo("HLS adaptive stream (native)");
          setLevels([]); // native HLS adapts on its own
        } else if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls({ startLevel: -1 });
          hlsRef.current = hls;
          hls.loadSource(v.src);
          hls.attachMedia(player);
          hls.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
            if (cancelled) return;
            setLevels(data.levels.map((l, i) => ({
              label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}kbps`,
              index: i
            })));
            setStreamInfo(`HLS adaptive stream • ${data.levels.length} quality levels`);
          });
          hls.on(window.Hls.Events.ERROR, (_, data) => {
            if (data.fatal && !cancelled) setStreamInfo("Stream error — tap retry");
          });
        } else {
          setStreamInfo("HLS not supported in this browser");
        }
      } else {
        player.src = v.src;
        setStreamInfo("Adaptive MP4 • progressive");
        setLevels([
          { label: "1080p", index: 0 },
          { label: "720p", index: 1 },
          { label: "480p", index: 2 }
        ]);
      }
    };

    const load = () => {
      if (video.hasMedia && !video.src) {
        setStreamInfo("Loading file from browser storage…");
        mediaReady.then(() => {
          if (cancelled) return;
          const fresh = getCatalogue().find((x) => x.id === video.id);
          if (fresh && fresh.src) playLocal(fresh);
          else setStreamInfo("Uploaded file not found — upload it again.");
        });
        return;
      }
      playLocal(video);
    };

    if (video.hls && !window.Hls) {
      // hls.js from CDN (only fetched when an HLS title is opened)
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js";
      s.onload = load;
      s.onerror = () => { if (!cancelled) setStreamInfo("Could not load stream library"); };
      document.head.appendChild(s);
    } else {
      load();
    }

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [video?.id]);

  /* ---------- Resume + progress saving ---------- */
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !video) return;

    const onLoaded = () => {
      if (saved > 5 && saved < player.duration - 5) player.currentTime = saved;
    };
    const onTime = () => {
      if (video.isLive) return;
      if (++saveTick.current % 10 === 0) Progress.set(video.id, player.currentTime);
      if (!historyAdded.current && player.currentTime >= 15) {
        historyAdded.current = true;
        History.add(video.id);
      }
    };
    const onEnded = () => {
      if (!video.isLive) Progress.set(video.id, 0);
      History.add(video.id);
      if (related.length) startUpNext(related[0]);
    };

    player.addEventListener("loadedmetadata", onLoaded);
    player.addEventListener("timeupdate", onTime);
    player.addEventListener("ended", onEnded);
    return () => {
      player.removeEventListener("loadedmetadata", onLoaded);
      player.removeEventListener("timeupdate", onTime);
      player.removeEventListener("ended", onEnded);
    };
  }, [video?.id, saved, related]);

  /* ---------- Close quality menu on outside click ---------- */
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  /* ---------- Up-next countdown ---------- */
  useEffect(() => {
    if (!upNext) return;
    if (upNext.countdown <= 0) { playNextVideo(upNext.video); return; }
    const t = setTimeout(() => setUpNext((u) => (u ? { ...u, countdown: u.countdown - 1 } : u)), 1000);
    return () => clearTimeout(t);
  }, [upNext]);

  if (!video) return <main className="page"><p className="empty">Title not found.</p></main>;

  const startPlayback = () => {
    const player = playerRef.current;
    if (!player) return;
    if (locked) return;
    if (saved > 5 && player.duration) player.currentTime = saved;
    player.play().catch(() => {});
  };

  const onPlayBig = () => {
    if (locked) setPinOpen(true);
    else startPlayback();
  };

  const onPinOk = () => {
    Parental.unlock(video);
    setUnlockedId(video.id);
    setPinOpen(false);
    refresh();
    showToast("Unlocked for this page view");
    setTimeout(startPlayback, 0);
  };

  const pickQuality = (level) => {
    if (level === -1) {
      setAutoQuality(true);
      if (hlsRef.current) hlsRef.current.currentLevel = -1;
      setQualityLabel("Auto");
      showToast(video.hls ? "Quality: Auto (adaptive)" : "Quality: Auto");
    } else {
      setAutoQuality(false);
      setForcedLevel(level);
      if (hlsRef.current) hlsRef.current.currentLevel = level;
      const label = levels[level] ? levels[level].label : "Manual";
      setQualityLabel(label);
      showToast(video.hls
        ? `Quality locked to ${label}`
        : `Quality preference: ${label} (source is single-rendition)`);
    }
    setMenuOpen(false);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard");
    } catch (e) {
      showToast("Copy this page's URL to share");
    }
  };

  const startUpNext = (next) => setUpNext({ video: next, countdown: 10 });
  const playNextVideo = (next) => { setUpNext(null); navigate(`/watch?id=${next.id}`); };

  const inList = Watchlist.has(video.id);

  return (
    <main className="watch-page">
      {/* PLAYER */}
      <section className="player-wrap">
        <div className="player-box">
          {locked && (
            <div className="lock-screen">
              <div className="lock-card">
                <div className="lock-icon">🔒</div>
                <h2>Age-restricted content</h2>
                <p>This title is rated <strong>{video.rating}</strong>. Enter the parental PIN to continue.</p>
                {Parental.isPinDefault() && (
                  <p className="hint-box">💡 Demo PIN: <strong>{Parental.DEMO_PIN}</strong></p>
                )}
                <button className="btn btn-primary" onClick={() => setPinOpen(true)}>Enter PIN</button>
              </div>
            </div>
          )}

          <video
            ref={playerRef}
            controls
            playsinline
            poster={video.thumb}
            style={{ display: locked ? "none" : undefined }}
          />

          <div className="player-bar">
            <div className="quality">
              <button
                className="btn btn-ghost btn-mini"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m); }}
              >
                ⚙ Quality: <strong>{qualityLabel}</strong>
              </button>
              {menuOpen && (
                <div className="quality-menu">
                  {[{ label: "Auto", index: -1 }, ...levels].map((it) => {
                    const active = (it.index === -1 && autoQuality) || (!autoQuality && it.index === forcedLevel);
                    return (
                      <button
                        key={it.index}
                        className={`q-item${active ? " active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); pickQuality(it.index); }}
                      >
                        {it.label}{active ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <span className="stream-info">{streamInfo}</span>
          </div>
        </div>

        <div className="watch-info">
          <div className="watch-head">
            <h1>{video.title}</h1>
            {video.isLive && <span className="badge live">● LIVE</span>}
          </div>
          <p className="card-meta">
            {video.year} • {video.category} • {video.genre} • {video.duration} • {video.rating} • {video.views} views
          </p>
          <p className="watch-desc">{video.desc}</p>

          <div className="watch-actions">
            <button className="btn btn-primary" onClick={onPlayBig}>▶ Play</button>
            <button
              className={`btn btn-ghost wl-btn${inList ? " active" : ""}`}
              onClick={() => {
                const added = Watchlist.toggle(video.id);
                refresh();
                showToast(added ? "Added to your watchlist" : "Removed from watchlist");
              }}
            >
              {inList ? "✓ In List" : "+ Watchlist"}
            </button>
            <button className="btn btn-ghost" onClick={share}>⤴ Share</button>
            {saved > 5 && !video.isLive && (
              <span className="resume-note">Resuming from {fmtTime(saved)}</span>
            )}
          </div>

          {upNext && (
            <div className="up-next">
              <h3>Autoplay up next in <span>{upNext.countdown}</span>s</h3>
              <div className="up-next-card">
                <img src={upNext.video.thumb} alt={upNext.video.title} />
                <div>
                  <h4>{upNext.video.title}</h4>
                  <p className="card-meta">{upNext.video.year} • {upNext.video.genre} • {upNext.video.duration}</p>
                </div>
              </div>
              <div className="up-next-actions">
                <button className="btn btn-primary" onClick={() => playNextVideo(upNext.video)}>Play now</button>
                <button className="btn btn-ghost" onClick={() => setUpNext(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* RELATED */}
      <section className="section">
        <div className="section-head"><h2>More like this</h2></div>
        <VideoRow videos={related} />
      </section>

      {/* DETAILS */}
      <section className="section">
        <div className="section-head"><h2>Details</h2></div>
        <table className="detail-table">
          <tbody>
            <tr><th>Title</th><td>{video.title}</td></tr>
            <tr><th>Category</th><td>{video.category}</td></tr>
            <tr><th>Genre</th><td>{video.genre}</td></tr>
            <tr><th>Released</th><td>{video.year}</td></tr>
            <tr><th>Duration</th><td>{video.duration}</td></tr>
            <tr><th>Rating</th><td>{video.rating}</td></tr>
            <tr><th>Views</th><td>{video.views}</td></tr>
            <tr><th>Streaming</th><td>{video.hls ? "Adaptive HLS (multi-bitrate)" : "Adaptive MP4 (ABR)"}</td></tr>
          </tbody>
        </table>
      </section>

      <footer className="footer"><p>StreamVibe — FEDF course project.</p></footer>

      {pinOpen && <PinModal onOk={onPinOk} onCancel={() => setPinOpen(false)} />}
    </main>
  );
}

/* ---------- Simple PIN prompt (shows demo hint when PIN is default) ---------- */
function PinModal({ onOk, onCancel }) {
  const [err, setErr] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (inputRef.current.value === Parental.pin()) onOk();
    else { setErr(true); inputRef.current.value = ""; inputRef.current.focus(); }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal modal-sm">
        <h2>🔒 Parental control</h2>
        <p className="muted">Enter the PIN to play this title.</p>
        {Parental.isPinDefault() && <p className="hint-box">💡 Demo PIN: <strong>{Parental.DEMO_PIN}</strong></p>}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="PIN"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        {err && <p className="error">Incorrect PIN.</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Unlock</button>
        </div>
      </div>
    </div>
  );
}
