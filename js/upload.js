/* ============================================================
   StreamVibe - Creator upload page
   Pick a video from the gallery/PC (media picker), store it in
   browser storage (localStorage / IndexedDB) and list uploads.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const uploads = () => Store.get("sv_uploads", []);
  const saveUploads = (list) => Store.set("sv_uploads", list);

  /* =========================================================
     MEDIA PICKER - click, browse or drag & drop
     ========================================================= */
  let selectedFile = null;      // video file from gallery/PC
  let selectedThumbFile = null; // optional thumbnail image
  let previewURL = null;

  function setMediaFile(file) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showToast("Please choose a video file");
      return;
    }
    selectedFile = file;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);

    const prev = $("filePreview");
    prev.src = previewURL;
    prev.hidden = false;
    prev.play().catch(() => {});

    $("fileMeta").textContent =
      `Selected: ${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)} MB • ${file.type || "video"}`;
    $("fileMeta").classList.remove("muted");
    $("clearFile").hidden = false;
    $("formError").hidden = true;
    showToast("Video selected ✓");
  }

  function clearMediaFile() {
    selectedFile = null;
    if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
    const prev = $("filePreview");
    prev.pause();
    prev.removeAttribute("src");
    prev.load();
    prev.hidden = true;
    $("fileMeta").textContent = "No file selected";
    $("fileMeta").classList.add("muted");
    $("clearFile").hidden = true;
    $("fFile").value = "";
  }

  $("pickFile").addEventListener("click", () => $("fFile").click());
  $("fFile").addEventListener("change", (e) => setMediaFile(e.target.files[0]));
  $("clearFile").addEventListener("click", clearMediaFile);

  const drop = $("fileDrop");
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragging"); }));
  drop.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    setMediaFile(file);
  });

  $("fThumbFile").addEventListener("change", (e) => {
    selectedThumbFile = e.target.files[0] || null;
    if (selectedThumbFile) showToast(`Thumbnail: ${selectedThumbFile.name}`);
  });

  /* ---------- Thumbnails ---------- */
  function readImageThumb(file) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);          // small image: data URL
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(file);
    });
  }

  function captureFrame(video) {
    try {
      if (!video.videoWidth || !video.videoHeight) return null;
      const W = 640, H = 360;
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
      return c.toDataURL("image/jpeg", 0.75);
    } catch (e) {
      return null;
    }
  }

  /* =========================================================
     SUBMIT
     ========================================================= */
  $("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = $("fTitle").value.trim();
    const desc = $("fDesc").value.trim();
    const category = $("fCat").value;
    const genre = $("fGenre").value.trim();
    const rating = $("fRating").value;
    const year = +$("fYear").value;
    const url = $("fSrc").value.trim();
    const thumbUrl = $("fThumbUrl").value.trim();
    const isLive = $("fLive").checked;

    if (!title || !desc || !category || !genre || !year) {
      $("formError").hidden = false;
      return;
    }
    if (!selectedFile && !url) {
      $("formError").hidden = false;
      return;
    }
    $("formError").hidden = true;

    const id = "u" + Date.now();

    // 1) thumbnail: picked image > frame from the video > URL > generated placeholder
    let thumb = thumbUrl;
    if (selectedThumbFile) thumb = await readImageThumb(selectedThumbFile);
    if (!thumb && selectedFile) {
      const v = $("filePreview");
      if (!v.videoWidth) {
        // wait (max 2s) until the preview has a decodable frame
        await new Promise((res) => {
          const t = setTimeout(res, 2000);
          v.addEventListener("loadeddata", () => { clearTimeout(t); res(); }, { once: true });
        });
      }
      thumb = captureFrame(v);
    }
    if (!thumb) thumb = `https://picsum.photos/seed/${encodeURIComponent(title)}/640/360`;

    // 2) video: store the actual file in browser storage, or use the URL
    let src = url;
    let hasMedia = false;
    if (selectedFile) {
      const res = await MediaStore.put(id, selectedFile);
      if (!res.ok) {
        $("formError").textContent = res.msg;
        $("formError").hidden = false;
        return;
      }
      hasMedia = true;
      src = "";
    }

    const video = {
      id, title, desc, category, genre, rating, year,
      duration: isLive ? "LIVE" : "—",
      thumb,
      src,
      hasMedia,
      hls: !hasMedia && (isLive || url.endsWith(".m3u8")),
      isLive,
      isNew: true,
      trending: false,
      featured: false,
      status: "Pending review",
      views: 0
    };

    const list = uploads();
    list.unshift(video);
    saveUploads(list);

    // visible across the site (creator preview + admin review)
    const extra = Store.get("sv_extra_videos", []);
    extra.unshift(video);
    Store.set("sv_extra_videos", extra);

    e.target.reset();
    $("fYear").value = 2026;
    clearMediaFile();
    selectedThumbFile = null;
    renderUploads();
    showToast(hasMedia
      ? "Video stored in your browser and submitted for review ✓"
      : "Video submitted for review ✓");
  });

  /* =========================================================
     MY UPLOADS LIST
     ========================================================= */
  function renderUploads() {
    const list = uploads();
    $("uploadCount").textContent = list.length;
    $("uploadEmpty").hidden = list.length > 0;

    $("uploadList").innerHTML = list.map((u) => `
      <div class="upload-item" data-id="${u.id}">
        <img src="${u.thumb}" alt="">
        <div class="upload-info">
          <h4>${u.title}</h4>
          <p class="card-meta">${u.category} • ${u.genre} • ${u.rating} • ${u.year}</p>
          <p class="card-meta">${u.hasMedia ? "💾 saved in browser storage" : "🔗 " + u.src}</p>
          <p class="status ${u.status.toLowerCase().replace(" ", "-")}">Status: ${u.status}</p>
        </div>
        <div class="upload-actions">
          <a class="btn btn-mini btn-ghost" href="watch.html?id=${u.id}">Preview</a>
          <button class="btn btn-mini btn-ghost del-btn" data-id="${u.id}">Delete</button>
        </div>
      </div>`).join("");

    const views = list.reduce((s, u) => s + (u.views || 0), 0);
    $("statsTable").innerHTML = `
      <tr><th>Videos uploaded</th><td>${list.length}</td></tr>
      <tr><th>Saved in browser storage</th><td>${list.filter((u) => u.hasMedia).length}</td></tr>
      <tr><th>Total views</th><td>${views.toLocaleString()}</td></tr>
      <tr><th>Pending review</th><td>${list.filter((u) => u.status === "Pending review").length}</td></tr>
      <tr><th>Published</th><td>${list.filter((u) => u.status === "Published").length}</td></tr>`;
  }

  renderUploads();

  /* ---------- Delete (also removes the stored file) ---------- */
  $("uploadList").addEventListener("click", (e) => {
    const btn = e.target.closest(".del-btn");
    if (!btn) return;
    const id = btn.dataset.id;
    saveUploads(uploads().filter((u) => u.id !== id));
    Store.set("sv_extra_videos", Store.get("sv_extra_videos", []).filter((v) => v.id !== id));
    const i = CATALOGUE.findIndex((v) => v.id === id);
    if (i > -1) CATALOGUE.splice(i, 1);          // gone from home page too
    const ov = Store.get("sv_video_overrides", {});
    delete ov[id];
    Store.set("sv_video_overrides", ov);
    Parental.setProtected(id, false);
    MediaStore.remove(id);
    localStorage.removeItem("sv_progress_" + id);
    renderUploads();
    showToast("Upload deleted");
  });

  // exposed for the drag/drop handler + easy testing
  window.pickMediaFile = setMediaFile;
});
