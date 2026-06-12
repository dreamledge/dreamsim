import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { teamsCol, leagueNewsCol } from '../lib/firestore';
import { checkAndGenerateNews } from '../engine/newsEngine';

const TYPE_META = {
  news:       { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>, label: 'News' },
  rumor:      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>, label: 'Rumor' },
  satire:     { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>, label: 'Satire' },
  podcast:    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>, label: 'Podcast' },
  social:     { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>, label: 'Social' },
  locker_room:{ icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, label: 'Locker Room' },
};

export default function LeagueNews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [newsCache, setNewsCache] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const teamSnap = await getDocs(query(teamsCol(), where('userId', '==', user.id)));
        const leagueIds = new Set(teamSnap.docs.map(d => d.data().leagueId));

        const commishSnap = await getDocs(query(collection(db, 'leagues'), where('commissionerId', '==', user.id)));
        commishSnap.docs.forEach(d => leagueIds.add(d.id));

        const allLeaguesSnap = await getDocs(collection(db, 'leagues'));
        const leagues = allLeaguesSnap.docs
          .filter(d => leagueIds.has(d.id))
          .map(d => ({ id: d.id, ...d.data() }));
        setLeagues(leagues);
      } catch (err) {
        console.error('LeagueNews load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const loadLeagueNews = async (leagueId) => {
    if (newsCache[leagueId]) return;
    try {
      const nSnap = await getDocs(query(leagueNewsCol(leagueId), orderBy('createdAt', 'desc'), limit(10)));
      setNewsCache(prev => ({ ...prev, [leagueId]: nSnap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    } catch (err) {
      console.error('loadLeagueNews error:', err);
      setNewsCache(prev => ({ ...prev, [leagueId]: [] }));
    }
  };

  const toggleExpand = (leagueId) => {
    if (expandedId === leagueId) {
      setExpandedId(null);
    } else {
      setExpandedId(leagueId);
      loadLeagueNews(leagueId);
      checkAndGenerateNews(leagueId);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">League News</h2>
      </div>

      {leagues.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No leagues yet. Create or join one!</p>
          <button onClick={() => navigate('/leagues/create')} className="btn-glow mt-4 px-5 py-2.5 text-sm inline-block">Create League</button>
        </div>
      ) : (
        <div className="space-y-2">
          {leagues.map((league, i) => {
            const isOpen = expandedId === league.id;
            const leagueNews = newsCache[league.id];
            return (
              <div key={league.id}
                className="glass-card overflow-hidden transition-all duration-300 animate-fade-up"
                style={{animationDelay: `${i * 0.06}s`}}>
                <button
                  onClick={() => toggleExpand(league.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff7b35] to-[#e83a4b] flex items-center justify-center text-sm font-bold font-display text-white shadow-sm shrink-0">
                      {league.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{league.name}</h3>
                      <p className="text-xs text-[var(--text-tertiary)]">Season {league.currentSeason || 1} &middot; {teamCountText(league)}</p>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-[var(--text-tertiary)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                <div className={`transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-4 pb-4 border-t border-[var(--border-subtle)] pt-3">
                    {!leagueNews ? (
                      <div className="flex justify-center py-4">
                        <div className="relative loader-2k" />
                      </div>
                    ) : leagueNews.length === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No news yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {leagueNews.map((item, ni) => (
                          <div key={item.id || ni}
                            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-secondary)]/50 transition-colors cursor-default"
                          >
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 mt-0.5">
                              {TYPE_META[item.type]?.icon || TYPE_META.news.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white leading-snug">{item.title}</span>
                                <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[10px] px-1.5 py-0.5 shrink-0">
                                  {TYPE_META[item.type]?.label || 'News'}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">{item.subheadline || item.body}</p>
                              <p className="text-[10px] text-[var(--text-tertiary)]/50 mt-0.5">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                        <Link to={`/leagues/${league.id}/news`}
                          className="block text-xs text-[var(--accent-orange)] font-medium text-center pt-2 hover:text-white transition-colors">
                          View all news →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function teamCountText(league) {
  if (!league.teamCount) return '';
  return `${league.teamCount} teams`;
}
