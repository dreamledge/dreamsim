import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDocs, collection, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { leagueDoc, leagueNewsCol } from '../lib/firestore';

const STORY_ICONS = {
  championship: <span className="text-[var(--accent-yellow)]">🏆</span>,
  trade: '🤝',
  rivalry: '⚔️',
  mvp: '⭐',
  general: '📰',
};

const STORY_COLORS = {
  championship: 'accent-stripe',
  trade: 'border-l-[var(--accent-blue)]',
  rivalry: 'border-l-[var(--accent-red)]',
  mvp: 'border-l-[var(--accent-yellow)]',
  general: '',
};

export default function NewsFeed() {
  const { leagueId } = useParams();
  const [news, setNews] = useState([]);
  const [leagueName, setLeagueName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const lSnap = await getDoc(leagueDoc(leagueId));
      if (lSnap.exists()) setLeagueName(lSnap.data().name);

      const nSnap = await getDocs(query(leagueNewsCol(leagueId), orderBy('createdAt', 'desc'), limit(20)));
      setNews(nSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [leagueId]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center justify-between animate-fade-up">
        <h2 className="font-display text-3xl tracking-wider">League News</h2>
        <Link to={`/leagues/${leagueId}`} className="text-xs text-[var(--accent-orange)] font-medium hover:text-white transition-colors">← Back</Link>
      </div>
      {leagueName && <p className="text-sm text-[var(--text-secondary)] animate-fade-up">{leagueName}</p>}

      {news.length === 0 ? (
        <div className="glass-card p-8 text-center animate-scale-in">
          <p className="text-[var(--text-secondary)]">No news yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {news.map((item, i) => (
            <div key={item.id || i} className={`glass-card p-4 hover:bg-[var(--bg-tertiary)] transition-all duration-200 border-l-2 ${STORY_COLORS[item.storyType] || 'border-l-[var(--accent-orange)]'}`} style={{animationDelay: `${i * 0.04}s`}}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 text-lg">
                  {STORY_ICONS[item.storyType] || '📰'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{item.body}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] capitalize">{item.storyType}</span>
                    {item.createdAt && <span className="text-xs text-[var(--text-tertiary)]">{new Date(item.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
