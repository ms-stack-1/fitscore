import { useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router";
import { Applicants } from "./routes/Applicants";
import { CandidatePage } from "./routes/CandidatePage";
import { Compare } from "./routes/Compare";
import { Home } from "./routes/Home";
import { RoleSetup } from "./routes/RoleSetup";
import { Roles } from "./routes/Roles";
import { Method } from "./routes/Method";
import { QuickMatch } from "./routes/QuickMatch";

export const LINKS = {
  portfolio: "https://shuja-portfolio-site.pages.dev/",
  github: "https://github.com/ms-stack-1/fitscore",
};

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => {
    if (dark) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("fs_theme", dark ? "dark" : "light");
    } catch {
      /* storage can be blocked; the toggle still works for this page */
    }
  }, [dark]);
  return (
    <button type="button" className="btn btn-ghost btn-sm theme-toggle" aria-pressed={dark} onClick={() => setDark((d) => !d)}>
      {dark ? "Light" : "Dark"} theme
    </button>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to FitScore</Link>
      </p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <Link to="/" className="brand" aria-label="FitScore home">
            <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
              <path d="M8.2 22.4A10 10 0 1 1 23.8 22.4" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M8.2 22.4A10 10 0 0 1 21.1 7.4" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
            </svg>
            FitScore
          </Link>
          <nav aria-label="Main">
            <NavLink to="/match">Quick match</NavLink>
            <NavLink to="/roles">Roles</NavLink>
            <NavLink to="/method">Method</NavLink>
            <a className="nav-ext" href={LINKS.github} target="_blank" rel="noopener">
              GitHub
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match" element={<QuickMatch />} />
          <Route path="/method" element={<Method />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/roles/new" element={<RoleSetup />} />
          <Route path="/roles/:roleId" element={<Applicants />} />
          <Route path="/roles/:roleId/edit" element={<RoleSetup />} />
          <Route path="/roles/:roleId/c/:candidateId" element={<CandidatePage />} />
          <Route path="/roles/:roleId/compare" element={<Compare />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="wrap footer-row">
          <p>
            Built by <a href={LINKS.portfolio}>Muhammad Shuja</a>. Open source on <a href={LINKS.github}>GitHub</a>.
          </p>
          <p className="muted">Runs in your browser. Decision support, not decision.</p>
        </div>
      </footer>
    </BrowserRouter>
  );
}
