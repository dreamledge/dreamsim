import { useState, useEffect } from 'react';
import { getDocs, collection, query, where, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { uid, storeItemsCol, storeItemDoc, userInventoryCol, userInventoryDoc } from '../lib/firestore';

const CATEGORY_ICONS = { logos: '🎨', themes: '🎭', jerseys: '👕', arenas: '🏟️', trophies: '🏆', intros: '🎬', ai: '🤖', analytics: '📊', history: '📜', pass: '🎫' };

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

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-[#e94560] border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">🛒 Store</h2>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap capitalize ${category === cat ? 'bg-[#e94560] text-white' : 'bg-[#16213e] text-gray-400'}`}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(item => {
          const owned = ownedIds.has(item.id);
          return (
            <div key={item.id} className="bg-[#16213e] rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">{CATEGORY_ICONS[item.category] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{item.name}</h3>
                <p className="text-xs text-gray-500 truncate">{item.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: item.isPremium ? 'rgba(234,179,8,0.2)' : 'rgba(74,222,128,0.2)', color: item.isPremium ? '#eab308' : '#4ade80' }}>
                    {item.isPremium ? 'Premium' : 'Free'}
                  </span>
                  {item.price > 0 && <span className="text-xs text-gray-500">{item.price} coins</span>}
                  {!item.price && <span className="text-xs text-green-400">Free</span>}
                </div>
              </div>
              {owned ? <span className="text-green-400 text-sm font-medium">✓ Owned</span> : (
                <button onClick={() => purchase(item.id)} className="bg-[#e94560] text-white px-3 py-1.5 rounded-lg text-xs font-semibold" disabled={item.isPremium}>
                  {item.isPremium ? 'Premium' : 'Get'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
