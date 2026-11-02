/* Subscription wall for deactivated users (was showSubscribeWall in common.js) */
import { Store, Subs } from "../lib/store.js";
import { DEFAULT_PLANS } from "../data.js";
import { useApp } from "../context.jsx";

export default function SubscribeWall() {
  const { user, refresh, showToast } = useApp();
  if (!user) return null;

  const plans = Store.get("sv_plans", DEFAULT_PLANS).filter((p) => p.active);

  const pick = (name) => {
    Subs.activate(user.email, name);
    refresh();
    showToast(`Subscribed to ${name} — access restored ✓`);
  };

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <h2>⛔ Access paused</h2>
        <p className="muted">
          The subscription for <strong>{user.email}</strong> was deactivated by the administrator.
          Choose a plan to restore access.
        </p>
        {plans.length ? (
          <div className="wall-plans">
            {plans.map((p) => (
              <button key={p.id} className="wall-plan" onClick={() => pick(p.name)}>
                <strong>{p.name}</strong>
                <span>{p.price}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="error">No plans are currently available. Contact the administrator.</p>
        )}
        <div className="hint-box">💡 Demo: pick any plan — it reactivates your access immediately (stored in localStorage).</div>
      </div>
    </div>
  );
}
