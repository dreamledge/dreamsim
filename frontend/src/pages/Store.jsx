import { useState, useEffect } from 'react';
import { getDocs, collection, query, where, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, storeItemsCol, storeItemDoc, userInventoryCol, userInventoryDoc } from '../lib/firestore';

const CATEGORY_ICONS = {
  logos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  themes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 0 0 0 14 7 7 0 1 0 0-14z"/></svg>,
  jerseys: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-4l-2-2-2 2H4v11l4 2v-9h12v9l4-2V7z"/></svg>,
  arenas: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  trophies: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>,
  intros: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  ai: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  analytics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  history: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pass: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
};

export default function Store() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const iSnap = await getDocs(storeItemsCol());
      setItems(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const invSnap = await getDocs(userInventoryCol(user.id));
      setInventory(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [user]);

  const purchase = async (itemId) => {
    try {
      await setDoc(userInventoryDoc(user.id, itemId), { itemId, acquiredAt: new Date().toISOString(), isActive: 1 });
      setInventory(prev => [...prev, { itemId }]);
      alert('Item acquired!');
    } catch (err) { alert(err.message); }
  };

  const categories = ['all', ...new Set(items.map(i => i.category))];
  const ownedIds = new Set(inventory.map(i => i.itemId));
  const filtered = category === 'all' ? items : items.filter(i => i.category === category);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="relative loader-2k" />
    </div>
  );

  return (
    <div className="space-y-4 stagger">
      <h2 className="font-display text-3xl tracking-wider animate-fade-up">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-2 -mt-1"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Store
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-1 animate-fade-up">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap capitalize transition-all ${
            category === cat ? 'btn-glow' : 'btn-ghost'
          }`}>
            {CATEGORY_ICONS[cat] && <span className="inline-block mr-1.5 align-middle">{CATEGORY_ICONS[cat]}</span>}
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((item, i) => {
          const owned = ownedIds.has(item.id);
          return (
            <div key={item.id} className="glass-card p-4 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-all duration-200 group" style={{animationDelay: `${i * 0.04}s`}}>
              <div className="w-11 h-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-lg group-hover:border-[var(--accent-orange)]/30 transition-colors">
                {CATEGORY_ICONS[item.category] || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{item.name}</h3>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`badge ${item.isPremium ? 'badge-premium' : 'bg-green-500/20 text-[var(--accent-green)]'}`}>
                    {item.isPremium ? 'Premium' : 'Free'}
                  </span>
                  {item.price > 0 && <span className="text-xs text-[var(--text-tertiary)]">{item.price} coins</span>}
                </div>
              </div>
              {owned ? (
                <span className="text-[var(--accent-green)] text-xs font-semibold flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Owned
                </span>
              ) : (
                <button onClick={() => purchase(item.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  item.isPremium ? 'btn-ghost opacity-50 cursor-not-allowed' : 'btn-glow'
                }`} disabled={item.isPremium}>
                  {item.isPremium ? 'Locked' : 'Get'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
