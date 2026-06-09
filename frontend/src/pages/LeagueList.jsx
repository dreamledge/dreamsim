import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, collection, doc, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol, leagueDoc } from '../lib/firestore';

export default function LeagueList() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fallback = setTimeout(() => setLoading(false), 8000);
    const load = async () => {
      try {
        const allLeaguesSnap = await getDocs(collection(db, 'leagues'));
        const userTeamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
        const userLeagueIds = new Set(userTeamSnap.docs.map(d => d.data().leagueId));

        const commishSnap = await getDocs(query(collection(db, 'leagues'), where('commissionerId', '==', user.id)));
        commishSnap.docs.forEach(d => userLeagueIds.add(d.id));

        const leagues = allLeaguesSnap.docs
          .filter(d => userLeagueIds.has(d.id))
          .map(d => ({ id: d.id, ...d.data() }));
        setLeagues(leagues);
      } catch (err) {
        console.error('LeagueList load error:', err);
      } finally {
        clearTimeout(fallback);
        setLoading(false);
      }
    };
    load();
    return () => clearTimeout(fallback);
  }, [user]);

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">My Leagues</h2>
        <button onClick={() => navigate('/leagues/create')} className="btn-glow px-4 py-2 text-sm">+ Create</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="relative loader-2k" />
        </div>
      ) : leagues.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No leagues yet. Create or join one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leagues.map((league, i) => (
            <Link key={league.id} to={`/leagues/${league.id}`} className="glass-card p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-all duration-200 group" style={{animationDelay: `${i * 0.06}s`}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff6b35] to-[#ff2d55] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm">L</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm">{league.name}</h3>
                    {user.id === league.commissionerId && (
                      <span className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 text-[10px] px-1.5 py-0">C</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">{league.description?.slice(0, 60)}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Season {league.currentSeason || 1}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {user.id === league.commissionerId && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(league); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 transition-all duration-200"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="glass-card p-6 w-full max-w-sm animate-scale-in space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <h3 className="font-display text-xl tracking-wider">Delete League?</h3>
              <p className="text-sm text-[var(--text-secondary)]">Are you sure you want to delete <span className="font-semibold text-white">{confirmDelete.name}</span>?</p>
              <p className="text-xs text-red-400">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteDoc(leagueDoc(confirmDelete.id));
                    setLeagues(prev => prev.filter(l => l.id !== confirmDelete.id));
                    setConfirmDelete(null);
                  } catch (err) {
                    console.error('Delete error:', err);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-sm font-semibold text-white hover:from-red-500 hover:to-red-400 transition-all duration-200 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
