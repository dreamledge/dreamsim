import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDocs, collection, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { leagueDoc, leagueNewsCol } from '../lib/firestore';

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

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">📰 League News</h2>
        <Link to={`/leagues/${leagueId}`} className="text-sm text-[#e94560]">← Back</Link>
      </div>
      {leagueName && <p className="text-sm text-gray-500">{leagueName}</p>}

      {news.length === 0 ? (
        <div className="bg-[#16213e] rounded-xl p-6 text-center"><p className="text-gray-500">No news yet.</p></div>
      ) : (
        <div className="space-y-3">
          {news.map((item, i) => (
            <div key={item.id || i} className="bg-[#16213e] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{item.storyType === 'championship' ? '🏆' : item.storyType === 'trade' ? '🤝' : item.storyType === 'rivalry' ? '⚔️' : item.storyType === 'mvp' ? '⭐' : '📰'}</span>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{item.body}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span className="capitalize px-1.5 py-0.5 rounded bg-[#1a1a2e]">{item.storyType}</span>
                    {item.createdAt && <span>{new Date(item.createdAt).toLocaleDateString()}</span>}
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
