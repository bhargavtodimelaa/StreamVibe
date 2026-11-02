/* Navbar (was static header + initNav in common.js) */
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Auth, Watchlist } from "../lib/store.js";
import { useApp } from "../context.jsx";

export default function Navbar() {
  const { version, refresh, search, setSearch, setSignupOpen, user } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const wlCount = Watchlist.all().length;

  const close = () => setOpen(false);

  const logout = () => {
    Auth.logout();
    refresh();
  };

  return (
    <header className="navbar">
      <div className="nav-inner">
        <Link className="brand" to="/" onClick={close}>▶ Stream<span>Vibe</span></Link>
        <button className="nav-toggle" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        <nav className={`nav-menu${open ? " open" : ""}`}>
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <Link to="/#browse" onClick={close}>Categories</Link>
          <NavLink to="/watchlist" onClick={close}>
            My List <span className="count">{wlCount}</span>
          </NavLink>
          <NavLink to="/upload" onClick={close}>Upload</NavLink>
          <NavLink to="/admin" onClick={close}>Admin</NavLink>
        </nav>
        <div className="nav-right">
          {location.pathname === "/" && (
            <input
              type="search"
              className="search"
              placeholder="Search titles, genres…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div>
            {user ? (
              <>
                <span className="user-chip">{user.name} <em>({user.role})</em></span>
                <button className="btn btn-ghost" onClick={logout}>Log out</button>
              </>
            ) : (
              <button className="btn btn-ghost">Log in</button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
