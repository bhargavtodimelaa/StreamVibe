/* Row/grid of cards (was common.js renderRow) */
import VideoCard from "./VideoCard.jsx";

export default function VideoRow({ videos, emptyMsg = "Nothing here yet.", className = "grid grid-row", progressOf }) {
  if (!videos.length) return <p className="empty">{emptyMsg}</p>;
  return (
    <div className={className}>
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} progress={progressOf ? progressOf(v) : 0} />
      ))}
    </div>
  );
}
