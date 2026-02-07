import { NavLink, useLocation } from 'react-router-dom';

function topNavClass(isActive: boolean) {
  return `top-nav__link${isActive ? ' top-nav__link--active' : ''}`;
}

export function TopNav() {
  const location = useLocation();
  const homeActive = location.pathname === '/' || (!location.pathname.startsWith('/monitor') && location.pathname !== '/login');

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <div className="top-nav__brand">Patient Safety MVP</div>
        <nav className="top-nav__tabs" aria-label="Primary navigation tabs">
          <NavLink to="/" className={() => topNavClass(homeActive)} end>
            Home
          </NavLink>
          <NavLink to="/monitor" className={({ isActive }) => topNavClass(isActive)}>
            Patient Monitor
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
