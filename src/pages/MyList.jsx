/* My List page (was watchlist.js): watchlist, history, parental controls */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context.jsx";
import { getCatalogue } from "../lib/catalogue.js";
import { History, Parental, Progress, Store, Watchlist } from "../lib/store.js";
import VideoRow from "../components/VideoRow.jsx";

export default function MyList() {
  const { version, refresh, showToast } = useApp();
  const [pinModal, setPinModal] = useState(false);

  useEffect(() => { document.title = "My List — StreamVibe"; }, []);

  const catalogue = getCatalogue(); // re-derived every render via version below
  void version;

  const byIds = (ids) => ids.map((id) => catalogue.find((v) => v.id === id)).filter(Boolean);
  const wl = byIds(Watchlist.all());
  const hist = byIds(History.all());

  const clearWl = () => { Watchlist.clear(); refresh(); showToast("Watchlist cleared"); };
  const clearHist = () => { History.clear(); refresh(); showToast("History cleared"); };

  /* ---------- Parental controls panel ---------- */
  const protectedList = catalogue.filter((v) => Parental.isProtected(v));

  const resetParental = () => {
    Parental.resetAll();
    refresh();
    renderAllToast();
  };
  const renderAllToast = () => showToast("PIN reset to 1234 and all protections cleared");

  return (
    <main className="page">
      <section className="section">
        <div className="section-head">
          <h2>❤️ My Watchlist</h2>
          <button className="btn btn-ghost btn-mini" onClick={clearWl}>Clear list</button>
        </div>
        <VideoRow videos={wl} emptyMsg="" className="grid" />
        {wl.length === 0 && (
          <p className="empty">Your watchlist is empty. Browse the home page and tap “+ Watchlist”.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>🕘 Continue watching</h2>
          <button className="btn btn-ghost btn-mini" onClick={clearHist}>Clear history</button>
        </div>
        <VideoRow videos={hist} emptyMsg="" className="grid" progressOf={(v) => Progress.get(v.id)} />
        {hist.length === 0 && <p className="empty">Nothing watched yet.</p>}
      </section>

      <section className="section">
        <div className="section-head"><h2>⚙ Parental controls</h2></div>
        <div className="panel">
          <p className="muted">
            One PIN is used for every video (default <strong>1234</strong>). The PIN is asked only for titles an
            administrator marked as <strong>protected</strong> in the admin panel — everything else plays directly.
          </p>
          <div className="hint-box">💡 Demo PIN: <strong>1234</strong> (change it below)</div>
          <p className="muted">
            PIN: <strong>{Parental.isPinDefault() ? "1234 (demo default)" : "set by you"}</strong> — unlocking lasts
            for the current page view only.
          </p>
          <h4 className="panel-sub">🔒 Protected titles</h4>
          <ul className="protected-list">
            {protectedList.length ? (
              protectedList.map((v) => (
                <li key={v.id}>🔒 <Link to={`/watch?id=${v.id}`}>{v.title}</Link></li>
              ))
            ) : (
              <li className="muted">No protected titles yet — an admin can toggle “Parental” per video in the admin panel.</li>
            )}
          </ul>
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={() => setPinModal(true)}>Set / change PIN</button>
            <button className="btn btn-ghost" onClick={resetParental}>Reset PIN &amp; protections</button>
          </div>
        </div>
      </section>

      <footer className="footer"><p>StreamVibe — FEDF course project.</p></footer>

      {pinModal && (
        <SetPinModal
          onClose={() => setPinModal(false)}
          onSave={(val) => {
            if (val.length < 4) { showToast("PIN must be at least 4 digits"); return false; }
            Parental.setPin(val);
            refresh();
            showToast("PIN updated");
            return true;
          }}
        />
      )}
    </main>
  );
}

function SetPinModal({ onClose, onSave }) {
  const [val, setVal] = useState("");
  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <h2>Set parental PIN</h2>
        <p className="muted">4–6 digits. You'll be asked for it to play restricted titles.</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="New PIN"
          value={val}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (onSave(val.trim())) onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
