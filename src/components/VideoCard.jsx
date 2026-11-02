/* Video card + status badge (was common.js videoCard/statusBadge) */
import { Link } from "react-router-dom";
import { Parental, Watchlist } from "../lib/store.js";
import { useApp } from "../context.jsx";

export function statusBadge(video) {
  if (video.isLive) return <span className="badge live">● LIVE</span>;
  if (video.isNew) return <span className="badge new">NEW</span>;
  if (video.trending) return <span className="badge trend">TRENDING</span>;
  return null;
}

export default function VideoCard({ video, progress = 0 }) {
  const { version, refresh, showToast } = useApp();
  const inList = Watchlist.has(video.id) && version >= 0;
  const locked = Parental.isLocked(video);

  const toggle = () => {
    const added = Watchlist.toggle(video.id);
    refresh();
    showToast(added ? "Added to your watchlist" : "Removed from watchlist");
  };

  return (
    <article className="card">
      <Link className="card-media" to={`/watch?id=${video.id}`} aria-label={`Watch ${video.title}`}>
        <img src={video.thumb} alt={video.title} loading="lazy" />
        <span className="card-play">▶</span>
        {statusBadge(video)}
        <span className="card-rating">{video.rating}</span>
        {locked && <span className="card-lock" title="Parental control locked">🔒</span>}
        {progress > 5 && (
          <div className="progress"><span style={{ width: `${Math.min(100, progress / 8)}%` }} /></div>
        )}
      </Link>
      <div className="card-body">
        <h3 className="card-title">{video.title}</h3>
        <p className="card-meta">{video.year} • {video.genre} • {video.duration}</p>
        <div className="card-actions">
          <button className={`btn btn-mini wl-btn${inList ? " active" : ""}`} onClick={toggle}>
            {inList ? "✓ In List" : "+ Watchlist"}
          </button>
          <span className="views">{video.views} views</span>
        </div>
      </div>
    </article>
  );
}
