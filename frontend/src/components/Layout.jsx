import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  {
    to: '/', label: 'Home',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  },
  {
    to: '/leagues', label: 'Leagues',
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
    to: '/trades', label: 'Trades',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen pb-20 noise-overlay">
      <header className="glass-strong sticky top-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6b35] to-[#ff2d55] flex items-center justify-center text-[10px] font-bold font-display text-white shadow-lg">DL</div>
            <h1 className="font-display text-xl tracking-wider text-white">Dynasty Sim</h1>
          </div>
          <div className="flex items-center gap-3">
            {user?.isPremium ? (
              <span className="badge badge-premium">Premium</span>
            ) : null}
            <span className="text-sm text-[var(--text-secondary)]">{user?.displayName || user?.username}</span>
            <button onClick={logout} className="text-xs text-[var(--text-tertiary)] hover:text-white transition-colors">Exit</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="glass-strong fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-subtle)]">
        <div className="max-w-lg mx-auto flex justify-around py-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-all duration-200 relative ${
                  isActive
                    ? 'text-[var(--accent-orange)] tab-active-indicator'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'drop-shadow-[0_0_6px_rgba(255,107,53,0.4)]' : ''}>{item.icon}</span>
                  <span className="font-medium tracking-wide">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
