/* Creator upload page (was upload.js): media picker, browser storage, my uploads, stats */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { getCatalogue } from "../lib/catalogue.js";
import { History, MediaStore, Parental, Store } from "../lib/store.js";

const uploadsOf = () => Store.get("sv_uploads", []);
const saveUploads = (list) => Store.set("sv_uploads", list);

function readImageThumb(file) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
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

const EMPTY = {
  title: "", desc: "", category: "", genre: "", rating: "G",
  year: 2026, src: "", thumbUrl: "", live: false
};

export default function Upload() {
  const { version, refresh, showToast } = useApp();
  useEffect(() => { document.title = "Upload — StreamVibe"; }, []);

  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  const uploads = uploadsOf();
  const catalogue = getCatalogue();
  void version;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  /* ---------- Media picker ---------- */
  const setMediaFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) { showToast("Please choose a video file"); return; }
    setFile(f);
    setPreviewURL((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
    setError("");
    showToast("Video selected ✓");
  };

  const clearMediaFile = () => {
    setFile(null);
    setPreviewURL((old) => { if (old) URL.revokeObjectURL(old); return null; });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const v = previewRef.current;
    if (v && previewURL) v.play().catch(() => {});
  }, [previewURL]);

  /* ---------- Submit ---------- */
  const submit = async (e) => {
    e.preventDefault();
    const { title, desc, category, genre, rating, year, src: url, thumbUrl, live: isLive } = form;

    if (!title || !desc || !category || !genre || !year) {
      setError("Please fill in all required fields — and pick a video file or paste a URL.");
      return;
    }
    if (!file && !url) {
      setError("Please fill in all required fields — and pick a video file or paste a URL.");
      return;
    }
    setError("");

    const id = "u" + Date.now();

    // 1) thumbnail: picked image > frame from the video > URL > generated placeholder
    let thumb = thumbUrl;
    if (thumbFile) thumb = await readImageThumb(thumbFile);
    if (!thumb && file) {
      const v = previewRef.current;
      if (v && !v.videoWidth) {
        await new Promise((res) => {
          const t = setTimeout(res, 2000);
          v.addEventListener("loadeddata", () => { clearTimeout(t); res(); }, { once: true });
        });
      }
      thumb = v ? captureFrame(v) : null;
    }
    if (!thumb) thumb = `https://picsum.photos/seed/${encodeURIComponent(title)}/640/360`;

    // 2) video: store the actual file in browser storage, or use the URL
    let src = url;
    let hasMedia = false;
    if (file) {
      const res = await MediaStore.put(id, file);
      if (!res.ok) { setError(res.msg); return; }
      hasMedia = true;
      src = "";
    }

    const video = {
      id, title, desc, category, genre, rating, year: +year,
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

    const list = uploadsOf();
    list.unshift(video);
    saveUploads(list);

    // visible across the site (creator preview + admin review)
    const extra = Store.get("sv_extra_videos", []);
    extra.unshift(video);
    Store.set("sv_extra_videos", extra);

    setForm(EMPTY);
    clearMediaFile();
    setThumbFile(null);
    refresh();
    showToast(hasMedia
      ? "Video stored in your browser and submitted for review ✓"
      : "Video submitted for review ✓");
  };

  /* ---------- Delete (also removes the stored file) ---------- */
  const remove = (id) => {
    saveUploads(uploadsOf().filter((u) => u.id !== id));
    Store.set("sv_extra_videos", Store.get("sv_extra_videos", []).filter((v) => v.id !== id));
    const ov = Store.get("sv_video_overrides", {});
    delete ov[id];
    Store.set("sv_video_overrides", ov);
    Parental.setProtected(id, false);
    MediaStore.remove(id);
    localStorage.removeItem("sv_progress_" + id);
    refresh();
    showToast("Upload deleted");
  };

  const views = uploads.reduce((s, u) => s + (u.views || 0), 0);

  return (
    <main className="page page-split">
      {/* UPLOAD FORM */}
      <section className="panel form-panel">
        <div className="section-head"><h2>🎬 Upload a video</h2></div>
        <p className="muted">For content creators. Videos are transcoded to adaptive quality automatically after upload.</p>

        <form onSubmit={submit} noValidate>
          <label>Title *
            <input type="text" required placeholder="e.g. My Great Short Film"
              value={form.title} onChange={set("title")} />
          </label>

          <label>Description *
            <textarea rows="3" required placeholder="What is this video about?"
              value={form.desc} onChange={set("desc")} />
          </label>

          <div className="field-row">
            <label>Category *
              <select required value={form.category} onChange={set("category")}>
                <option value="">Select…</option>
                <option>Movies</option>
                <option>TV Shows</option>
                <option>Live</option>
                <option>Documentaries</option>
                <option>Kids</option>
              </select>
            </label>
            <label>Genre *
              <input type="text" required placeholder="e.g. Drama"
                value={form.genre} onChange={set("genre")} />
            </label>
          </div>

          <div className="field-row">
            <label>Content rating *
              <select value={form.rating} onChange={set("rating")}>
                <option>G</option>
                <option>PG</option>
                <option>PG-13</option>
                <option>R</option>
              </select>
            </label>
            <label>Release year *
              <input type="number" min="1900" max="2100" required
                value={form.year} onChange={set("year")} />
            </label>
          </div>

          {/* MEDIA PICKER: gallery / PC file */}
          <label>Video file from your gallery / PC *</label>
          <div
            className={`file-drop${dragging ? " dragging" : ""}`}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); setMediaFile(e.dataTransfer.files?.[0]); }}
          >
            <input
              type="file"
              accept="video/*"
              hidden
              ref={fileInputRef}
              onChange={(e) => setMediaFile(e.target.files[0])}
            />
            <div className="file-drop-inner">
              <span className="file-icon">🎞️</span>
              <p><strong>Click “Browse media” or drag &amp; drop a video here</strong></p>
              <div className="form-actions">
                <button type="button" className="btn btn-primary btn-mini" onClick={() => fileInputRef.current?.click()}>
                  Browse media…
                </button>
                {file && (
                  <button type="button" className="btn btn-ghost btn-mini" onClick={clearMediaFile}>Remove file</button>
                )}
              </div>
            </div>
            <p className={`file-meta${file ? "" : " muted"}`}>
              {file
                ? `Selected: ${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)} MB • ${file.type || "video"}`
                : "No file selected"}
            </p>
          </div>
          <video ref={previewRef} className="file-preview" controls hidden={!previewURL} src={previewURL || undefined} />

          <div className="field-row">
            <label>…or paste a video URL
              <input type="url" placeholder="https://…/video.mp4"
                value={form.src} onChange={set("src")} />
            </label>
            <label>…or paste a thumbnail URL
              <input type="url" placeholder="https://…/thumb.jpg"
                value={form.thumbUrl} onChange={set("thumbUrl")} />
            </label>
          </div>

          <label className="check">Thumbnail image from your PC (optional — otherwise a frame from the video is used)
            <input type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files[0] || null)} />
          </label>

          <label className="check">
            <input type="checkbox" checked={form.live} onChange={set("live")} /> This is a live stream (HLS .m3u8 source)
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Upload</button>
            <button type="button" className="btn btn-ghost"
              onClick={() => { setForm(EMPTY); clearMediaFile(); setThumbFile(null); setError(""); }}>
              Reset
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </section>

      {/* MY UPLOADS */}
      <section className="panel">
        <div className="section-head">
          <h2>📁 My uploads</h2>
          <span className="badge">{uploads.length}</span>
        </div>
        <div className="upload-list">
          {uploads.map((u) => (
            <div className="upload-item" key={u.id}>
              <img src={u.thumb} alt="" />
              <div className="upload-info">
                <h4>{u.title}</h4>
                <p className="card-meta">{u.category} • {u.genre} • {u.rating} • {u.year}</p>
                <p className="card-meta">{u.hasMedia ? "💾 saved in browser storage" : "🔗 " + u.src}</p>
                <p className={`status ${u.status.toLowerCase().replace(" ", "-")}`}>Status: {u.status}</p>
              </div>
              <div className="upload-actions">
                <Link className="btn btn-mini btn-ghost" to={`/watch?id=${u.id}`}>Preview</Link>
                <button className="btn btn-mini btn-ghost" onClick={() => remove(u.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        {uploads.length === 0 && <p className="empty">You haven't uploaded anything yet.</p>}

        <div className="panel section-head" style={{ marginTop: "1.5rem" }}>
          <h2>📊 Creator stats</h2>
        </div>
        <table className="detail-table">
          <tbody>
            <tr><th>Videos uploaded</th><td>{uploads.length}</td></tr>
            <tr><th>Saved in browser storage</th><td>{uploads.filter((u) => u.hasMedia).length}</td></tr>
            <tr><th>Total views</th><td>{views.toLocaleString()}</td></tr>
            <tr><th>Pending review</th><td>{uploads.filter((u) => u.status === "Pending review").length}</td></tr>
            <tr><th>Published</th><td>{uploads.filter((u) => u.status === "Published").length}</td></tr>
          </tbody>
        </table>
      </section>

      <footer className="footer"><p>StreamVibe — FEDF course project.</p></footer>
    </main>
  );
}
