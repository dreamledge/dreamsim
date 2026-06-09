import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, collection, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol } from '../lib/firestore';

export default function LeagueList() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const allLeaguesSnap = await getDocs(collection(db, 'leagues'));
      const userTeamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
      const userLeagueIds = new Set(userTeamSnap.docs.map(d => d.data().leagueId));
      const leagues = allLeaguesSnap.docs
        .filter(d => userLeagueIds.has(d.id))
        .map(d => ({ id: d.id, ...d.data() }));
      setLeagues(leagues);
      setLoading(false);
    };
    load();
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
            <Link key={league.id} to={`/leagues/${league.id}`} className="glass-card p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-all duration-200 group accent-stripe" style={{animationDelay: `${i * 0.06}s`}}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff6b35] to-[#ff2d55] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm">L</div>
                <div>
                  <h3 className="font-semibold text-sm">{league.name}</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">{league.description?.slice(0, 60)}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Season {league.currentSeason || 1}</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-orange)] opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
