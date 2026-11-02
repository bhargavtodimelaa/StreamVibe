/* ============================================================
   StreamVibe - Live catalogue
   Merges the sample titles with creator uploads and applies
   admin overrides (featured / removed) so they survive reloads.
   Resolves local files (uploaded from gallery/PC) to playable URLs.
   ============================================================ */

import { CATALOGUE } from "../data.js";
import { Store, MediaStore } from "./store.js";

/* Playable URLs for files kept in browser storage (IndexedDB / localStorage) */
const mediaSrcCache = {};

export function getCatalogue() {
  const cat = CATALOGUE.map((v) => ({ ...v }));

  Store.get("sv_extra_videos", []).forEach((v) => {
    if (!cat.find((x) => x.id === v.id)) cat.push({ ...v });
  });

  // Apply admin overrides (featured / removed) so they survive reloads
  const ov = Store.get("sv_video_overrides", {});
  Object.keys(ov).forEach((id) => {
    const o = ov[id];
    const i = cat.findIndex((v) => v.id === id);
    if (o.removed) {
      if (i > -1) cat.splice(i, 1);
    } else if (i > -1 && typeof o.featured === "boolean") {
      cat[i].featured = o.featured;
    }
  });

  // Resolve local files to playable URLs once they are loaded
  cat.forEach((v) => {
    if (v.hasMedia && !v.src && mediaSrcCache[v.id]) v.src = mediaSrcCache[v.id];
  });

  return cat;
}

/* ---------- Resolve local files to playable URLs ---------- */
export const mediaReady = (async () => {
  const local = getCatalogue().filter((v) => v.hasMedia && !v.src);
  await Promise.all(local.map(async (v) => {
    try {
      const url = await MediaStore.getURL(v.id);
      if (url) mediaSrcCache[v.id] = url;
    } catch (e) { /* leave src empty */ }
  }));
})();
