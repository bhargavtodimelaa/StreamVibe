/* App shell: router, nav, footer, global gates (auth + subscription wall) */
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppProvider, useApp } from "./context.jsx";
import Navbar from "./components/Navbar.jsx";
import AuthGate from "./components/AuthGate.jsx";
import SubscribeWall from "./components/SubscribeWall.jsx";
import Home from "./pages/Home.jsx";
import Watch from "./pages/Watch.jsx";
import MyList from "./pages/MyList.jsx";
import Upload from "./pages/Upload.jsx";
import Admin from "./pages/Admin.jsx";

function Gates() {
  const { user, signupOpen, wallOpen } = useApp();
  const authOpen = !user || signupOpen;
  return (
    <>
      {authOpen && <AuthGate force={!user} initialTab={signupOpen && user ? "signup" : "login"} />}
      {wallOpen && <SubscribeWall />}
    </>
  );
}

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Navbar />
        <ScrollManager />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/watchlist" element={<MyList />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        <Gates />
      </BrowserRouter>
    </AppProvider>
  );
}
