import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { API_CONFIG } from '../data/apiConfig';

/* ═══════════════════════════════════════════════════════════════
   UTILITAS — Google Sheets parser & Drive URL converter
   ═══════════════════════════════════════════════════════════════ */

function parseGoogleSheetsResponse(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\(({.*})\)/s);
  if (!match) throw new Error('Format response Google Sheets tidak valid');
  const json = JSON.parse(match[1]);
  const table = json.table;
  const hasAutoHeaders = table.cols.some((col) => col.label && col.label.trim() !== '');
  let cols, dataRows;
  if (hasAutoHeaders) {
    cols = table.cols.map((col) => col.label || '');
    dataRows = table.rows;
  } else {
    cols = table.rows[0].c.map((cell) => (cell ? String(cell.v || '') : ''));
    dataRows = table.rows.slice(1);
  }
  return dataRows
    .filter((row) => row && row.c)
    .map((row) => {
      const obj = {};
      cols.forEach((colName, i) => {
        if (!colName) return;
        const cell = row.c[i];
        if (!cell || cell.v == null) { obj[colName] = ''; return; }
        obj[colName] = cell.f != null ? String(cell.f) : cell.v;
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((v) => v !== ''));
}

function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return driveMatch[1];
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  return null;
}

function toDirectImageUrl(url) {
  const fileId = extractDriveFileId(url);
  if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
  return url;
}

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/* ═══════════════════════════════════════════════════════════════
   DATA STATIS FALLBACK
   ═══════════════════════════════════════════════════════════════ */

const FALLBACK_PROKER = [
  { nama: 'Sosialisasi Berbarcode', deskripsi: 'Memberikan sosialisasi KK berbarcode.', media: null, tipe: 'Foto', kategori: 'Utama' },
  { nama: 'Pemasangan Peta', deskripsi: 'Pemasangan peta administrasi padukuhan.', media: null, tipe: 'Foto', kategori: 'Utama' },
  { nama: 'Pendampingan TPA', deskripsi: 'Mendampingi belajar mengaji Iqro dan Al-Quran.', media: null, tipe: 'Foto', kategori: 'Pendukung' },
  { nama: 'Pendampingan Posyandu', deskripsi: 'Membantu layanan kesehatan balita dan lansia.', media: null, tipe: 'Foto', kategori: 'Pendukung' },
  { nama: 'Bimbingan Belajar', deskripsi: 'Membantu siswa mempelajari materi pelajaran.', media: null, tipe: 'Foto', kategori: 'Pendukung' },
  { nama: 'Kumpulan Warga', deskripsi: 'Mengikuti kegiatan mempererat kerukunan.', media: null, tipe: 'Foto', kategori: 'Pendukung' },
  { nama: 'Kerja Bakti', deskripsi: 'Gotong royong bersama warga.', media: null, tipe: 'Foto', kategori: 'Pendukung' },
  { nama: 'Pendampingan MPLS', deskripsi: 'Mendampingi siswa baru MPLS.', media: null, tipe: 'Foto', kategori: 'Pendukung' },
  { nama: 'Pembuatan Website Digitalisasi', deskripsi: 'Menyediakan website informasi.', media: null, tipe: 'Foto', kategori: 'Individu' },
  { nama: 'Pembuatan POC', deskripsi: 'Membuat pupuk organik cair limbah rumah.', media: null, tipe: 'Foto', kategori: 'Individu' }
];

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Video Handlers
   ═══════════════════════════════════════════════════════════════ */

function AutoPlayVideo({ proker }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const url = proker.media;
  const youtubeId = extractYouTubeId(url);
  const driveFileId = extractDriveFileId(url);
  const isDirectVideo = !youtubeId && !driveFileId;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1, rootMargin: '200px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (youtubeId) {
    const ytUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`;
    const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    return (
      <div ref={containerRef} className="w-full h-full bg-[#eee] overflow-hidden relative">
        <img src={thumbnailUrl} alt={proker.nama} className="absolute inset-0 w-full h-full object-cover" />
        {isVisible && <iframe src={ytUrl} title={proker.nama} className="absolute inset-0 w-[300%] h-[300%] -top-[100%] -left-[100%] border-0 pointer-events-none opacity-0 transition-opacity duration-1000" onLoad={(e) => e.target.style.opacity = '1'} allow="autoplay; encrypted-media" />}
      </div>
    );
  }

  if (driveFileId) {
    const driveUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
    const thumbnailUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
    return (
      <div ref={containerRef} className="w-full h-full bg-[#eee] overflow-hidden relative">
        <img src={thumbnailUrl} alt={proker.nama} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
        {isVisible && <iframe src={driveUrl} title={proker.nama} className="absolute inset-0 w-[180%] h-[180%] -top-[40%] -left-[40%] border-0 pointer-events-none opacity-0 transition-opacity duration-1000" onLoad={(e) => e.target.style.opacity = '1'} allow="autoplay; encrypted-media" />}
      </div>
    );
  }

  if (isDirectVideo) return <DirectVideo url={url} nama={proker.nama} containerRef={containerRef} />;
  return null;
}

function DirectVideo({ url, nama, containerRef }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { video.play().catch(() => {}); } else { video.pause(); }
    }, { threshold: 0.3 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#eee] overflow-hidden relative">
      <video ref={videoRef} src={url} className="w-full h-full object-cover" muted loop playsInline preload="auto" />
    </div>
  );
}

function MediaRenderer({ proker }) {
  const isVideo = proker.tipe?.toLowerCase() === 'video';
  if (isVideo && proker.media) return <AutoPlayVideo proker={proker} />;
  return (
    <div className="w-full h-full bg-[#eee] overflow-hidden relative">
      {proker.media ? (
        <img src={proker.media} alt={proker.nama} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'; }} />
      ) : null}
      <div className={`absolute inset-0 ${proker.media ? 'hidden' : 'flex'} items-center justify-center bg-gradient-to-br from-[#7ba084]/20 to-[#b3d4b6]/30`}>
        <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
    </div>
  );
}

function ModalVideo({ url, nama }) {
  const youtubeId = extractYouTubeId(url);
  const driveFileId = extractDriveFileId(url);
  if (youtubeId) return <iframe src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`} title={nama} loading="lazy" className="w-full h-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />;
  if (driveFileId) return <iframe src={`https://drive.google.com/file/d/${driveFileId}/preview`} title={nama} loading="lazy" className="w-full h-full border-0" allow="autoplay; encrypted-media" allowFullScreen />;
  return <video src={url} className="w-full h-full object-contain" controls autoPlay muted playsInline preload="metadata" />;
}

function DetailModal({ proker, onClose }) {
  const isVideo = proker.tipe?.toLowerCase() === 'video';
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const bgColor = proker.kategori?.toLowerCase() === 'utama' ? '#6a705c' : 
                  proker.kategori?.toLowerCase() === 'pendukung' ? '#858c66' : 
                  proker.kategori?.toLowerCase() === 'individu' ? '#9da18b' : '#87b060';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#fdfbf7]/80 backdrop-blur-md" />
      
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative rounded-[2.5rem] border-8 border-white/40 max-w-3xl w-full shadow-2xl p-6 sm:p-10 pt-16 sm:pt-20 mt-8" style={{ backgroundColor: bgColor }} onClick={(e) => e.stopPropagation()}>
        
        {/* Title Pill overlapping the top edge */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-[#fdfbf7] px-6 sm:px-10 py-3 rounded-full font-bold tracking-widest text-sm sm:text-xl border-[6px] shadow-[0_4px_10px_rgba(0,0,0,0.1)] whitespace-nowrap text-center max-w-[90%] overflow-hidden text-ellipsis" style={{ color: bgColor, borderColor: bgColor }}>
          DETAIL PROGRAM
        </div>

        {/* subtle texture inside modal */}
        <div className="absolute inset-0 rounded-[2rem] opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiAvPgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] mix-blend-overlay pointer-events-none" />

        <button onClick={onClose} className="absolute top-4 right-4 sm:top-6 sm:right-6 z-40 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors border-2 border-white/40 backdrop-blur-sm shadow-md">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        <div className="relative z-10 flex flex-col gap-6">
          {proker.media && (
            <div className="w-full aspect-video bg-black/20 rounded-[1.5rem] overflow-hidden border-[4px] border-white/30 shadow-lg relative">
              {isVideo ? <ModalVideo url={proker.media} nama={proker.nama} /> : <img src={proker.media} alt={proker.nama} className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
            </div>
          )}
          <div className="bg-white/10 rounded-[1.5rem] p-6 sm:p-8 backdrop-blur-sm border border-white/20 shadow-inner">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4 drop-shadow-sm">{proker.nama}</h2>
            <p className="text-white/95 text-sm sm:text-base leading-relaxed font-medium drop-shadow-sm whitespace-pre-line">{proker.deskripsi}</p>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ExpoBanner() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProker, setSelectedProker] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    async function fetchProker() {
      if (!API_CONFIG.proker) {
        setData(FALLBACK_PROKER);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(API_CONFIG.proker);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const rows = parseGoogleSheetsResponse(text);
        const mapped = rows.map((row) => {
          const rawMedia = row['Link'] || row['link'] || row['Link Drive'] || row['link drive'] || row['Foto'] || row['foto'] || null;
          const tipe = (row['Tipe'] || row['tipe'] || 'Foto').trim();
          const isVideo = tipe.toLowerCase() === 'video';
          return {
            nama: row['Nama'] || row['nama'] || '',
            deskripsi: row['Deskripsi'] || row['deskripsi'] || '',
            media: isVideo ? rawMedia : toDirectImageUrl(rawMedia),
            tipe,
            kategori: row['Kategori'] || row['kategori'] || 'Lainnya',
          };
        });
        setData(mapped.length > 0 ? mapped : FALLBACK_PROKER);
      } catch (err) {
        console.error('⚠️ Error:', err);
        setError(err.message);
        setData(FALLBACK_PROKER);
      } finally {
        setLoading(false);
      }
    }
    fetchProker();
  }, []);

  const groups = useMemo(() => {
    const Utama = data.filter(p => p.kategori?.toLowerCase() === 'utama');
    const Pendukung = data.filter(p => p.kategori?.toLowerCase() === 'pendukung');
    const Individu = data.filter(p => p.kategori?.toLowerCase() === 'individu');
    return { Utama, Pendukung, Individu };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#fdfbf7] relative overflow-hidden font-['Poppins',sans-serif] text-gray-800 pb-32">
      {/* Blurry Green Accents for the organic background feel */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#87b060]/30 blur-[100px]" />
        <div className="absolute top-[40%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#87b060]/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[70vw] h-[70vw] rounded-full bg-[#87b060]/35 blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Header Section */}
        <header className="flex flex-col items-center justify-center text-center mb-16 relative w-full min-h-[100svh]">
          
          <div className="flex items-center justify-center gap-6 mb-6">
            <img src="/images/LogoUPNYogyakarta.png" alt="Logo UPN" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md" />
            <a href="https://www.instagram.com/giling.gemilang?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener noreferrer" className="hover:scale-105 transition-transform duration-300">
              <img src="/images/LOGOKKNGILINGTRANSPARAN.png" alt="Logo KKN" className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-md" />
            </a>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-600 leading-snug">
            REKAPITULASI PROGRAM KERJA<br/>
            <span className="text-gray-500 font-medium text-lg sm:text-2xl md:text-3xl">KKN UPN "VETERAN" YOGYAKARTA</span>
          </h1>

          <div className="mt-8 bg-[#63725b] text-white px-8 py-2.5 rounded-full font-bold tracking-widest text-sm sm:text-lg shadow-md z-10 relative">
            KELOMPOK AB.84.064
          </div>

          <p className="mt-4 text-[#676865] font-bold text-sm sm:text-lg max-w-lg tracking-wide">
            Dukuh Giling, Kalurahan Tuksono,<br/>Kapanewon Sentolo, Kulon Progo
          </p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-24 sm:bottom-28 flex flex-col items-center justify-center text-[#63725b] font-bold tracking-widest text-xs sm:text-sm animate-bounce opacity-80"
          >
            <span className="mb-2 uppercase">Mulai Menjelajahi</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </motion.div>
        </header>

        {loading ? (
          <div className="text-center py-20 animate-pulse text-[#63725b] font-bold text-xl">Memuat Program Kerja...</div>
        ) : (
          <div className="space-y-20 pb-36">
            <CategorySection title="PROGRAM KERJA UTAMA" items={groups.Utama} onClick={setSelectedProker} bgColor="#6a705c" textColor="#fefae8" />
            <CategorySection title="PROGRAM KERJA PENDUKUNG" items={groups.Pendukung} onClick={setSelectedProker} bgColor="#858c66" textColor="#fefae8" />
            <CategorySection title="PROGRAM KERJA INDIVIDU" items={groups.Individu} onClick={setSelectedProker} bgColor="#9da18b" textColor="#fefae8" />
          </div>
        )}
      </div>

      {/* Footer Element */}
      <div className="fixed bottom-0 inset-x-0 pointer-events-none z-20 flex flex-col items-center overflow-hidden">
         <a 
           href="https://www.instagram.com/giling.gemilang?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" 
           target="_blank" 
           rel="noopener noreferrer"
           className="bg-white/95 backdrop-blur-sm text-[#63725b] px-6 py-2 rounded-full font-bold tracking-widest text-sm sm:text-base flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] mb-4 pointer-events-auto border-2 border-[#87b060]/20 hover:scale-105 transition-transform duration-300"
         >
           <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
           <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.8-5.46-.35-2.26.2-4.63 1.56-6.42 1.43-1.92 3.8-3.08 6.18-3.07.03 1.34-.01 2.68.02 4.02-1.28-.05-2.58.55-3.32 1.58-.69.96-.92 2.21-.6 3.37.31 1.15 1.14 2.13 2.22 2.57 1.18.5 2.56.44 3.69-.17 1.05-.57 1.83-1.62 2.05-2.8.1-2.92-.05-5.84.07-8.76z"/></svg>
           @giling.gemilang
         </a>
         {/* Green grass wavy pattern block */}
         <div className="w-full h-8 bg-[#87b060] rounded-t-[50%] shadow-[0_-5px_15px_rgba(135,176,96,0.3)]"></div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedProker && (
          <DetailModal proker={selectedProker} onClose={() => setSelectedProker(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategorySection({ title, items, onClick, bgColor, textColor }) {
  if (!items || items.length === 0) return null;

  const mid = Math.ceil(items.length / 2);
  const col1 = items.slice(0, mid);
  const col2 = items.slice(mid);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 80 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative pt-8"
    >
      {/* Container */}
      <div 
        className="rounded-[2.5rem] p-5 sm:p-10 pt-16 sm:pt-20 shadow-2xl relative z-10 border-8 border-white/40"
        style={{ backgroundColor: bgColor }}
      >
        
        {/* Section Title Pill - Removed overflow-hidden from parent so it isn't clipped */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-12 -translate-y-1/2 z-30 bg-[#fdfbf7] px-6 sm:px-10 py-3 rounded-full font-bold tracking-widest text-base sm:text-xl border-[6px] shadow-[0_4px_10px_rgba(0,0,0,0.1)] whitespace-nowrap"
          style={{ color: bgColor, borderColor: bgColor }}
        >
          {title}
        </div>

        {/* subtle texture inside container for depth */}
        <div className="absolute inset-0 rounded-[2rem] opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiAvPgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] mix-blend-overlay pointer-events-none" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 relative z-10">
          <div className="flex flex-col gap-5 sm:gap-8">
            {col1.map((item, i) => (
              <ProkerCard key={i} item={item} index={i + 1} onClick={() => onClick(item)} textColor={textColor} />
            ))}
          </div>
          {col2.length > 0 && (
            <div className="flex flex-col gap-5 sm:gap-8">
              {col2.map((item, i) => (
                <ProkerCard key={i + mid} item={item} index={i + mid + 1} onClick={() => onClick(item)} textColor={textColor} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ProkerCard({ item, index, onClick, textColor }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index - 1) * 0.1, ease: "easeOut" }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="bg-transparent group cursor-pointer flex gap-4 sm:gap-6 hover:bg-white/10 p-3 sm:p-4 rounded-2xl transition-colors duration-300 relative z-20 will-change-transform"
      onClick={onClick}
    >
      {/* Thumbnail (Polaroid Style) */}
      <div 
        className="w-32 h-32 sm:w-44 sm:h-44 md:w-36 md:h-36 lg:w-48 lg:h-48 flex-shrink-0 bg-[#fdfbf7] p-2 sm:p-2.5 shadow-md relative group-hover:shadow-xl transition-all duration-300 transform-gpu"
        style={{ transform: `rotate(${index % 2 === 0 ? '3deg' : '-3deg'})` }}
      >
         <div className="w-full h-full relative overflow-hidden bg-black/5">
           <MediaRenderer proker={item} />
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start gap-3 mb-2 sm:mb-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center font-black text-xs sm:text-sm flex-shrink-0 shadow-sm mt-0.5" style={{ color: '#5e654c' }}>
            {index}
          </div>
          <h3 
            className="font-bold text-base sm:text-xl leading-tight group-hover:opacity-80 transition-opacity drop-shadow-sm"
            style={{ color: textColor }}
          >
            {item.nama}
          </h3>
        </div>
        <p 
          className="text-xs sm:text-sm leading-relaxed text-justify drop-shadow-sm font-normal mt-1 sm:mt-2"
          style={{ color: textColor, opacity: 0.95 }}
        >
          {item.deskripsi}
        </p>
      </div>
    </motion.div>
  );
}
