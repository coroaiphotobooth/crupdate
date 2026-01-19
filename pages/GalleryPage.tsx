
import React, { useEffect, useState } from 'react';
import { GalleryItem } from '../types';
import { fetchGallery, deletePhotoFromGas } from '../lib/appsScript';

interface GalleryPageProps {
  onBack: () => void;
  activeEventId?: string;
}

const GalleryPage: React.FC<GalleryPageProps> = ({ onBack, activeEventId }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGallery();
    // Refresh every 30 seconds if in gallery
    const interval = setInterval(loadGallery, 30000);
    return () => clearInterval(interval);
  }, [activeEventId]);

  const loadGallery = async () => {
    try {
      const data = await fetchGallery(activeEventId);
      setItems(data);
      setError(null);
    } catch (err: any) {
      console.error("Gallery fetch error:", err);
      setError(`CONNECTION_ERROR`);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (item: GalleryItem) => {
    // Jika imageUrl sudah ada (URL thumbnail dari GAS), gunakan itu
    if (item.imageUrl && item.imageUrl.startsWith('http')) {
       // Jika masih menggunakan lh3 (lama), ubah ke thumbnail resmi yang lebih stabil
       if (item.imageUrl.includes('lh3.googleusercontent.com')) {
         return `https://drive.google.com/thumbnail?id=${item.id}&sz=w600`;
       }
       return item.imageUrl;
    }
    // Fallback: Drive direct thumbnail logic
    return `https://drive.google.com/thumbnail?id=${item.id}&sz=w600`;
  };

  const getShareUrl = (item: GalleryItem) => {
    if (item.downloadUrl && item.downloadUrl.includes('drive.google.com')) return item.downloadUrl;
    return `https://drive.google.com/file/d/${item.id}/view`;
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    const pin = window.prompt("ENTER ADMIN PIN TO DELETE:");
    if (!pin) return;
    
    setIsDeleting(true);
    try {
      const res = await deletePhotoFromGas(selectedItem.id, pin);
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== selectedItem.id));
        setSelectedItem(null);
      } else {
        alert(res.error || "Delete failed");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col p-6 md:p-12 bg-[#050505] overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-center w-full mb-12 max-w-7xl mx-auto gap-6 shrink-0">
        <button onClick={onBack} className="text-white flex items-center gap-3 hover:text-purple-400 uppercase tracking-[0.3em] font-bold transition-all group shrink-0">
          <svg className="w-6 h-6 transform group-hover:-translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          BACK
        </button>
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-heading text-white neon-text italic uppercase tracking-tighter">EVENT GALLERY</h2>
          <p className="text-[10px] md:text-xs text-purple-400 tracking-[0.6em] uppercase mt-2 font-bold italic">
            {activeEventId ? 'ACTIVE ARCHIVE' : 'CENTRAL ARCHIVE'}
          </p>
        </div>
        <button onClick={loadGallery} className="p-2 text-white/40 hover:text-white transition-colors">
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-2">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-purple-500/20" />
            <span className="text-purple-400 font-mono text-xs tracking-[0.5em] animate-pulse">RETRIEVING DATA...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
             <h3 className="text-red-500 font-heading text-xl uppercase italic">Database Offline</h3>
             <button onClick={loadGallery} className="text-white/60 hover:text-white underline font-mono text-xs">TRY AGAIN</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] opacity-30 text-center">
             <h3 className="text-2xl font-heading mb-3 text-white tracking-widest uppercase italic">ARCHIVE_EMPTY</h3>
             <p className="font-mono text-[10px]">No snapshots found for this event.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-8 pb-32">
            {items.map((item, idx) => (
              <div 
                key={item.id || idx} 
                onClick={() => setSelectedItem(item)} 
                className="group relative aspect-[9/16] overflow-hidden bg-white/5 border border-white/10 cursor-pointer hover:border-purple-500 transition-all rounded-lg shadow-xl"
              >
                <img 
                  src={getImageUrl(item)} 
                  alt={item.conceptName} 
                  loading="lazy" 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                  onError={(e) => {
                    // Jika gagal load, coba thumbnail alternatif
                    (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w400`;
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="text-white font-heading text-[10px] tracking-widest border border-white/40 px-3 py-1">VIEW</span>
                </div>
                <div className="absolute bottom-0 left-0 p-4 w-full bg-gradient-to-t from-black via-black/60 to-transparent">
                  <p className="text-white text-[10px] font-heading tracking-widest truncate uppercase italic">{item.conceptName}</p>
                  <p className="text-white/40 text-[8px] font-mono mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 max-w-5xl w-full items-center">
            <div className="relative w-full max-w-[320px] aspect-[9/16] border-2 border-white/10 shadow-2xl rounded-xl shrink-0 overflow-hidden bg-gray-900">
              <img src={getImageUrl(selectedItem).replace('sz=w600', 'sz=w1000')} className="w-full h-full object-cover" alt="Preview" />
            </div>
            <div className="flex flex-col items-center lg:items-start flex-1 w-full">
              <h3 className="text-3xl font-heading text-white neon-text mb-2 italic uppercase">MEMORY_PREVIEW</h3>
              <p className="text-purple-400 font-mono text-xs mb-10 tracking-widest uppercase">{selectedItem.conceptName} // {new Date(selectedItem.createdAt).toLocaleString()}</p>
              
              <div className="bg-white p-4 rounded-2xl mb-10 shadow-2xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getShareUrl(selectedItem))}`} 
                  className="w-44 h-44 md:w-56 md:h-56" 
                  alt="QR Code" 
                />
              </div>
              
              <div className="flex flex-col gap-4 w-full max-w-sm">
                <button 
                  onClick={() => window.open(getShareUrl(selectedItem), '_blank')} 
                  className="py-4 bg-purple-600 font-heading text-white tracking-widest uppercase italic hover:bg-purple-500 transition-all shadow-lg"
                >
                  OPEN IN DRIVE
                </button>
                <button 
                  onClick={handleDelete} 
                  disabled={isDeleting} 
                  className="py-4 border-2 border-red-900/40 text-red-500 font-heading uppercase italic text-xs hover:bg-red-900/10 transition-all"
                >
                  {isDeleting ? "PERFORMING ERASE..." : "DELETE FROM ARCHIVE"}
                </button>
                <button 
                  onClick={() => setSelectedItem(null)} 
                  className="py-2 text-white/50 hover:text-white uppercase text-[10px] tracking-[0.3em] font-bold mt-4"
                >
                  CLOSE PREVIEW
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
