/* Shared app state: version bump (localStorage reactivity), toast, auth gates */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Auth, Subs } from "./lib/store.js";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [signupOpen, setSignupOpen] = useState(false); // "Sign up instead" from admin login

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const showToast = useCallback((msg) => setToast({ msg, id: Date.now() + Math.random() }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const user = useMemo(() => Auth.current(), [version]);
  const wallOpen = !!user && user.role !== "admin" && !Subs.isActive(user.email);

  const value = useMemo(
    () => ({ version, refresh, toast, showToast, search, setSearch, signupOpen, setSignupOpen, user, wallOpen }),
    [version, refresh, toast, showToast, search, signupOpen, user, wallOpen]
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toast && <div className="toast show">{toast.msg}</div>}
    </AppCtx.Provider>
  );
}

export function useApp() {
  return useContext(AppCtx);
}
