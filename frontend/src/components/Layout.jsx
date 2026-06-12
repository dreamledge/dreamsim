import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  {
    to: '/', label: 'Home',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/><path d="M4 22V9"/><path d="M20 22V9"/></svg>
  },
  {
    to: '/stats', label: 'Stats',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
  },
  {
    to: '/store', label: 'Store',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
  },
  {
    to: '/news', label: 'News',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen pb-20 noise-overlay">
      <header className="glass-strong sticky top-0 z-50 px-3 sm:px-6 lg:px-8 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white hover:text-[var(--accent-orange)] transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            {user?.isPremium ? (
              <span className="badge badge-premium">Premium</span>
            ) : null}
            <span className="text-sm text-[var(--text-secondary)]">{user?.displayName || user?.username}</span>
            <button onClick={logout} className="text-xs text-[var(--text-tertiary)] hover:text-white transition-colors">Exit</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-5 max-w-3xl mx-auto w-full">
        {children}
      </main>

      <nav className="glass-strong fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto flex justify-around gap-1 sm:gap-4 py-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs transition-all duration-200 relative ${
                  isActive
                    ? 'text-[var(--accent-orange)] tab-active-indicator'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`shrink-0 ${isActive ? 'drop-shadow-[0_0_6px_rgba(255,107,53,0.4)]' : ''}`}>{item.icon}</span>
                  <span className="font-medium tracking-wide truncate max-w-[60px] sm:max-w-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
