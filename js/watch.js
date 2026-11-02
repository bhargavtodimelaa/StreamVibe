/* ============================================================
   StreamVibe - Watch page
   Player, adaptive/HLS streaming, quality menu, resume,
   parental gate, up-next countdown, related titles
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const player = $("player");

  const params = new URLSearchParams(location.search);
  const video = CATALOGUE.find((v) => v.id === params.get("id")) || CATALOGUE[0];

  /* ---------- Page info ---------- */
  document.title = `${video.title} — StreamVibe`;
  $("wTitle").textContent = video.title;
  $("wMeta").textContent = `${video.year} • ${video.category} • ${video.genre} • ${video.duration} • ${video.rating} • ${video.views} views`;
  $("wDesc").textContent = video.desc;
  $("wLive").hidden = !video.isLive;
  player.poster = video.thumb;

  const wlBtn = $("wWl");
  wlBtn.dataset.id = video.id;
  const syncWl = () => {
    const inList = Watchlist.has(video.id);
    wlBtn.classList.toggle("active", inList);
    wlBtn.innerHTML = inList ? "✓ In List" : "+ Watchlist";
  };
  syncWl();
  wlBtn.addEventListener("click", () => setTimeout(syncWl, 0));

  /* ---------- Details table ---------- */
  $("detailTable").innerHTML = `
    <tr><th>Title</th><td>${video.title}</td></tr>
    <tr><th>Category</th><td>${video.category}</td></tr>
    <tr><th>Genre</th><td>${video.genre}</td></tr>
    <tr><th>Released</th><td>${video.year}</td></tr>
    <tr><th>Duration</th><td>${video.duration}</td></tr>
    <tr><th>Rating</th><td>${video.rating}</td></tr>
    <tr><th>Views</th><td>${video.views}</td></tr>
    <tr><th>Streaming</th><td>${video.hls ? "Adaptive HLS (multi-bitrate)" : "Adaptive MP4 (ABR)"}</td></tr>`;

  /* ---------- Related titles ---------- */
  const related = CATALOGUE.filter(
    (v) => v.id !== video.id && (v.genre === video.genre || v.category === video.category)
  ).slice(0, 6);
  renderRow($("relatedRow"), related.length ? related : CATALOGUE.filter((v) => v.id !== video.id).slice(0, 6));

  /* =========================================================
     PLAYER — adaptive streaming
     HLS sources use hls.js (multi-bitrate ABR) when available;
     MP4 sources fall back to progressive playback.
     ========================================================= */
  let hls = null;
  let levels = [];      // available quality levels
  let autoQuality = true;
  let forcedLevel = -1;

  function loadSource() {
    if (video.hasMedia && !video.src) {
      $("streamInfo").textContent = "Loading file from browser storage…";
      mediaReady.then(() => {
        if (video.src) playLocal();
        else $("streamInfo").textContent = "Uploaded file not found — upload it again.";
      });
      return;
    }
    playLocal();
  }

  function playLocal() {
    if (video.hls) {
      const nativeHls = player.canPlayType("application/vnd.apple.mpegurl");
      if (nativeHls) {
        player.src = video.src;                       // Safari: native HLS
        $("streamInfo").textContent = "HLS adaptive stream (native)";
        levels = [];  // native HLS adapts on its own
        buildQualityMenu();
      } else if (window.Hls && window.Hls.isSupported()) {
        hls = new window.Hls({ startLevel: -1 });      // ABR picks the level
        hls.loadSource(video.src);
        hls.attachMedia(player);
        hls.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
          levels = data.levels.map((l, i) => ({
            label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}kbps`,
            index: i
          }));
          $("streamInfo").textContent = `HLS adaptive stream • ${levels.length} quality levels`;
          buildQualityMenu();
        });
        hls.on(window.Hls.Events.ERROR, (_, data) => {
          if (data.fatal) $("streamInfo").textContent = "Stream error — tap retry";
        });
      } else {
        $("streamInfo").textContent = "HLS not supported in this browser";
      }
    } else {
      player.src = video.src;
      $("streamInfo").textContent = "Adaptive MP4 • progressive";
      levels = [
        { label: "1080p", index: 0 },
        { label: "720p", index: 1 },
        { label: "480p", index: 2 }
      ];
      buildQualityMenu();
    }
  }

  // hls.js from CDN (only fetched when an HLS title is opened)
  if (video.hls && !window.Hls) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js";
    s.onload = loadSource;
    s.onerror = () => { player.src = ""; $("streamInfo").textContent = "Could not load stream library"; };
    document.head.appendChild(s);
  } else {
    loadSource();
  }

  /* ---------- Quality menu ---------- */
  function buildQualityMenu() {
    const menu = $("qualityMenu");
    const items = [{ label: "Auto", index: -1 }, ...levels.filter((l) => l.index !== undefined)];
    menu.innerHTML = items
      .map((it, i) => {
        const active = (it.index === -1 && autoQuality) || (!autoQuality && it.index === forcedLevel);
        return `<button class="q-item ${active ? "active" : ""}" data-level="${it.index}">${it.label}${active ? " ✓" : ""}</button>`;
      })
      .join("");
  }

  $("qualityBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("qualityMenu");
    menu.hidden = !menu.hidden;
    buildQualityMenu();
  });

  $("qualityMenu").addEventListener("click", (e) => {
    const item = e.target.closest(".q-item");
    if (!item) return;
    const level = +item.dataset.level;
    if (level === -1) {
      autoQuality = true;
      if (hls) hls.currentLevel = -1;
      $("qualityLabel").textContent = "Auto";
      showToast(video.hls ? "Quality: Auto (adaptive)" : "Quality: Auto");
    } else {
      autoQuality = false;
      forcedLevel = level;
      if (hls) hls.currentLevel = level;
      const label = levels[level] ? levels[level].label : "Manual";
      $("qualityLabel").textContent = label;
      showToast(video.hls
        ? `Quality locked to ${label}`
        : `Quality preference: ${label} (source is single-rendition)`);
    }
    $("qualityMenu").hidden = true;
  });

  document.addEventListener("click", () => { $("qualityMenu").hidden = true; });

  /* ---------- Parental gate ---------- */
  const locked = Parental.isLocked(video);
  if (locked) {
    $("lockScreen").hidden = false;
    $("lockRating").textContent = video.rating;
    if (Parental.isPinDefault()) {
      const hint = $("pinHint");
      hint.hidden = false;
      hint.innerHTML = `💡 Demo PIN: <strong>${Parental.DEMO_PIN}</strong>`;
    }
    player.style.display = "none";
    $("unlockBtn").addEventListener("click", () => {
      askPin((ok, pin) => {
        if (ok) {
          Parental.unlock(video);
          $("lockScreen").hidden = true;
          player.style.display = "";
          showToast("Unlocked for this page view");
          startPlayback();
        }
      });
    });
  }

  /* ---------- Resume + progress saving ---------- */
  const saved = Progress.get(video.id);
  if (saved > 5 && !video.isLive) {
    const note = $("resumeNote");
    note.hidden = false;
    note.textContent = `Resuming from ${fmtTime(saved)}`;
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function startPlayback() {
    if (locked && Parental.isLocked(video)) return;
    if (saved > 5 && player.duration) player.currentTime = saved;
    player.play().catch(() => {});
  }

  $("playBig").addEventListener("click", () => {
    if (locked && Parental.isLocked(video)) {
      $("unlockBtn").click();
    } else {
      startPlayback();
    }
  });

  let saveTick = 0;
  let historyAdded = false;
  player.addEventListener("timeupdate", () => {
    if (video.isLive) return;
    if (++saveTick % 10 === 0) Progress.set(video.id, player.currentTime);
    // count it as watched once they're 15s in (drives recommendations)
    if (!historyAdded && player.currentTime >= 15) {
      historyAdded = true;
      History.add(video.id);
    }
  });
  player.addEventListener("ended", () => {
    if (!video.isLive) Progress.set(video.id, 0);
    History.add(video.id);
    if (related.length) showUpNext(related[0]);
  });

  /* ---------- Share ---------- */
  $("shareBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("Link copied to clipboard");
    } catch (e) {
      showToast("Copy this page's URL to share");
    }
  });

  /* ---------- Up-next countdown ---------- */
  let countTimer = null;
  function showUpNext(next) {
    const wrap = $("upNext");
    wrap.hidden = false;
    $("upNextCard").innerHTML = `
      <img src="${next.thumb}" alt="${next.title}">
      <div>
        <h4>${next.title}</h4>
        <p class="card-meta">${next.year} • ${next.genre} • ${next.duration}</p>
      </div>`;
    let n = 10;
    $("countdown").textContent = n;
    countTimer = setInterval(() => {
      n--;
      $("countdown").textContent = n;
      if (n <= 0) playNextVideo(next);
    }, 1000);

    $("playNext").onclick = () => playNextVideo(next);
    $("cancelNext").onclick = () => {
      clearInterval(countTimer);
      wrap.hidden = true;
    };
  }

  function playNextVideo(next) {
    clearInterval(countTimer);
    location.href = `watch.html?id=${next.id}`;
  }

  /* ---------- Auto-play first frame muted hint ---------- */
  player.addEventListener("loadedmetadata", () => {
    if (saved > 5 && saved < player.duration - 5) player.currentTime = saved;
  });
});
