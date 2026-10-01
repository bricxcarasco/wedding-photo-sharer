import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', ic: '🏠', label: 'Home', end: true },
  { to: '/upload', ic: '📸', label: 'Add' },
  { to: '/photos', ic: '💕', label: 'My Photos' },
  { to: '/gallery', ic: '✨', label: 'Gallery' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Primary">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <span className="ic" aria-hidden="true">
            {t.ic}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
