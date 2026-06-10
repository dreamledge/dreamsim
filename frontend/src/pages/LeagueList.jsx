import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, collection, doc, getDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol, leagueDoc, leagueMembersCol, leagueNewsCol, championshipsCol, draftsCol, seasonsCol } from '../lib/firestore';

export default function LeagueList() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [allLeagues, setAllLeagues] = useState([]);
  const [userLeagueIds, setUserLeagueIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fallback = setTimeout(() => { if (!cancelled) setLoading(false); }, 8000);
    const load = async () => {
      try {
        const [allLeaguesSnap, userTeamSnap] = await Promise.all([
          getDocs(collection(db, 'leagues')),
          getDocs(query(teamsCol(), where('userId', '==', user.id))),
        ]);
        const userLeagueIds = new Set(userTeamSnap.docs.map(d => d.data().leagueId));

        const commishSnap = await getDocs(query(collection(db, 'leagues'), where('commissionerId', '==', user.id)));
        commishSnap.docs.forEach(d => userLeagueIds.add(d.id));

        const myLeagues = allLeaguesSnap.docs
          .filter(d => userLeagueIds.has(d.id))
          .map(d => ({ id: d.id, ...d.data() }));
        const all = allLeaguesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!cancelled) {
          setLeagues(myLeagues);
          setAllLeagues(all);
          setUserLeagueIds(userLeagueIds);
        }
      } catch (err) {
        console.error('LeagueList load error:', err);
      } finally {
        if (!cancelled) { clearTimeout(fallback); setLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [user]);

  const isInLeague = (leagueId) => userLeagueIds.has(leagueId);

  const filteredForSearch = search.trim()
    ? allLeagues.filter(l => {
        const q = search.toLowerCase();
        return l.name?.toLowerCase().includes(q) || l.id?.toLowerCase().includes(q);
      })
    : null;

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">My Leagues</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowJoinModal(true)} className="btn-ghost px-3 py-2 text-sm">Join</button>
          <button onClick={() => navigate('/leagues/create')} className="btn-glow px-4 py-2 text-sm">+ Create</button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-2 glass-card px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)] shrink-0">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leagues by name or league code..."
            className="flex-1 bg-transparent text-white text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[var(--text-tertiary)] hover:text-white transition-colors p-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="relative loader-2k" />
        </div>
      ) : search.trim() ? (
        /* ── Search Results ── */
        filteredForSearch.length === 0 ? (
          <div className="glass-card p-8 text-center animate-scale-in">
            <p className="text-[var(--text-secondary)]">No leagues match "{search}"</p>
          </div>
        ) : (
          <div className="space-y-2 animate-fade-up">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">{filteredForSearch.length} result{filteredForSearch.length !== 1 ? 's' : ''}</p>
            {filteredForSearch.map((league, i) => (
              <div key={league.id} className="glass-card p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-all duration-200 group" style={{animationDelay: `${i * 0.04}s`}}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm shrink-0">L</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm truncate">{league.name}</h3>
                      {user?.id === league.commissionerId && (
                        <span className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 text-[10px] px-1.5 py-0 shrink-0">C</span>
                      )}
                    </div>
                    {league.description && <p className="text-xs text-[var(--text-tertiary)] truncate">{league.description}</p>}
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{league.teams?.length || 0} teams · Season {league.currentSeason || 1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {isInLeague(league.id) ? (
                    <button onClick={() => navigate(`/leagues/${league.id}`)} className="btn-ghost px-2.5 py-1.5 text-xs font-medium">
                      Open
                    </button>
                  ) : (
                    <button onClick={() => navigate(`/teams/create?league=${league.id}`)} className="btn-glow px-2.5 py-1.5 text-xs font-medium">
                      Join
                    </button>
                  )}
                  {user?.id === league.commissionerId && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(league); }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 transition-all duration-200"
                      title="Delete league"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : leagues.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No leagues yet. Create or join one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leagues.map((league, i) => (
            <Link key={league.id} to={`/leagues/${league.id}`} className="glass-card p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-all duration-200 group" style={{animationDelay: `${i * 0.06}s`}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm">L</div>
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
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200" disabled={deleting}>Cancel</button>
              <button onClick={async () => {
                setDeleting(true);
                try {
                  const id = confirmDelete.id;
                  const batch = writeBatch(db);

                  const membersSnap = await getDocs(leagueMembersCol(id));
                  membersSnap.docs.forEach(d => batch.delete(d.ref));

                  const newsSnap = await getDocs(leagueNewsCol(id));
                  newsSnap.docs.forEach(d => batch.delete(d.ref));

                  const champSnap = await getDocs(championshipsCol(id));
                  champSnap.docs.forEach(d => batch.delete(d.ref));

                  const draftSnap = await getDocs(draftsCol(id));
                  for (const draftDoc of draftSnap.docs) {
                    const picksSnap = await getDocs(collection(db, 'leagues', id, 'drafts', draftDoc.id, 'picks'));
                    picksSnap.docs.forEach(d => batch.delete(d.ref));
                    batch.delete(draftDoc.ref);
                  }

                  const teamQuery = query(teamsCol(), where('leagueId', '==', id));
                  const teamSnap = await getDocs(teamQuery);
                  for (const tDoc of teamSnap.docs) {
                    const playersSnap = await getDocs(collection(db, 'teams', tDoc.id, 'players'));
                    playersSnap.docs.forEach(d => batch.delete(d.ref));
                    batch.delete(tDoc.ref);
                  }

                  batch.delete(leagueDoc(id));
                  await batch.commit();

                  setLeagues(prev => prev.filter(l => l.id !== id));
                  setAllLeagues(prev => prev.filter(l => l.id !== id));
                  setConfirmDelete(null);
                } catch (err) { console.error('Delete error:', err); }
                finally { setDeleting(false); }
              }} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-sm font-semibold text-white hover:from-red-500 hover:to-red-400 transition-all duration-200 disabled:opacity-50" disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join Modal ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); }}>
          <div className="glass-card p-6 w-full max-w-sm animate-scale-in space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1">
              <h3 className="font-display text-xl tracking-wider">Join League</h3>
              <p className="text-sm text-[var(--text-secondary)]">Enter a league code to join, or search above.</p>
            </div>
            <div className="space-y-2">
              <input
                type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                placeholder="Paste league code..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[var(--accent-orange)] focus:shadow-[0_0_0_3px_rgba(255,107,53,0.1)] transition-all placeholder:text-[var(--text-tertiary)] text-center tracking-widest uppercase"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && joinCode.trim()) {
                    setJoining(true); setJoinError('');
                    try {
                      const snap = await getDoc(leagueDoc(joinCode.trim()));
                      if (!snap.exists()) { setJoinError('League not found. Check the code.'); setJoining(false); return; }
                      navigate(`/teams/create?league=${joinCode.trim()}`);
                    } catch { setJoinError('Error finding league.'); setJoining(false); }
                  }
                }}
              />
              {joinError && <p className="text-xs text-red-400 text-center">{joinError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); }} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200">Cancel</button>
              <button
                onClick={async () => {
                  if (!joinCode.trim()) return;
                  setJoining(true); setJoinError('');
                  try {
                    const snap = await getDoc(leagueDoc(joinCode.trim()));
                    if (!snap.exists()) { setJoinError('League not found. Check the code.'); setJoining(false); return; }
                    navigate(`/teams/create?league=${joinCode.trim()}`);
                  } catch { setJoinError('Error finding league.'); setJoining(false); }
                }}
                disabled={joining || !joinCode.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff7b35] to-[#e83a4b] text-sm font-semibold text-white disabled:opacity-50 transition-all duration-200"
              >
                {joining ? 'Looking up...' : 'Join'}
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] text-center">League code is the league ID shown in the URL.</p>
          </div>
        </div>
      )}
    </div>
  );
}
