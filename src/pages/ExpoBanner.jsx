import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import { API_CONFIG } from '../data/apiConfig';

/* ═══════════════════════════════════════════════════════════════
   UTILITAS — Google Sheets parser & Drive URL converter
   ═══════════════════════════════════════════════════════════════ */

function parseGoogleSheetsResponse(text) {
  const match = text.match(
    /google\.visualization\.Query\.setResponse\(({.*})\)/s
  );
  if (!match) throw new Error('Format response Google Sheets tidak valid');

  const json = JSON.parse(match[1]);
  const table = json.table;

  const hasAutoHeaders = table.cols.some(
    (col) => col.label && col.label.trim() !== ''
  );

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
        if (!cell || cell.v == null) {
          obj[colName] = '';
          return;
        }
        obj[colName] = cell.f != null ? String(cell.f) : cell.v;
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((v) => v !== ''));
}

/** Extract Google Drive file ID dari berbagai format URL */
function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;

  // Pattern: drive.google.com/file/d/{FILE_ID}/...
  const driveMatch = url.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
  );
  if (driveMatch) return driveMatch[1];

  // Pattern: drive.google.com/open?id={FILE_ID}
  const openMatch = url.match(
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/
  );
  if (openMatch) return openMatch[1];

  return null;
}

function toDirectImageUrl(url) {
  const fileId = extractDriveFileId(url);
  if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`;
  return url;
}

function toDriveVideoEmbedUrl(url) {
  const fileId = extractDriveFileId(url);
  if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
  return url;
}

/** URL langsung untuk <video> tag (autoplay muted) */
function toDriveVideoDirectUrl(url) {
  const fileId = extractDriveFileId(url);
  if (fileId) return `https://drive.google.com/uc?export=view&id=${fileId}`;
  return url;
}

/* ═══════════════════════════════════════════════════════════════
   DATA STATIS FALLBACK
   ═══════════════════════════════════════════════════════════════ */

const FALLBACK_PROKER = [
  {
    nama: 'Pembuatan Website Expo KKN',
    deskripsi: 'Membangun portal informasi digital untuk menampilkan seluruh program kerja KKN 064.',
    media: null,
    tipe: 'Foto',
    kategori: 'Utama',
  },
  {
    nama: 'Pendataan Kependudukan',
    deskripsi: 'Melakukan pendataan komprehensif kependudukan di lokasi KKN.',
    media: null,
    tipe: 'Foto',
    kategori: 'Utama',
  },
  {
    nama: 'Sosialisasi Digitalisasi',
    deskripsi: 'Workshop pemanfaatan teknologi digital untuk masyarakat.',
    media: null,
    tipe: 'Foto',
    kategori: 'Utama',
  },
  {
    nama: 'Sosialisasi Kesehatan',
    deskripsi: 'Penyuluhan kesehatan masyarakat dan pola hidup bersih.',
    media: null,
    tipe: 'Foto',
    kategori: 'Pendukung',
  },
  {
    nama: 'Kerja Bakti Lingkungan',
    deskripsi: 'Gotong royong bersama warga untuk menjaga kebersihan lingkungan.',
    media: null,
    tipe: 'Foto',
    kategori: 'Pendukung',
  },
  {
    nama: 'Bimbingan Belajar Anak',
    deskripsi: 'Pendampingan belajar untuk anak-anak dengan metode yang menyenangkan.',
    media: null,
    tipe: 'Foto',
    kategori: 'Individu',
  },
  {
    nama: 'Dokumentasi Kegiatan',
    deskripsi: 'Mendokumentasikan seluruh rangkaian kegiatan KKN sebagai arsip digital.',
    media: null,
    tipe: 'Foto',
    kategori: 'Individu',
  },
];

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Floating Particles Background
   ═══════════════════════════════════════════════════════════════ */

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.12 + 0.04,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -60, 0],
            x: [0, Math.random() * 30 - 15, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Hero Section dengan Parallax
   ═══════════════════════════════════════════════════════════════ */

function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const titleY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const subtitleY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.6], [1, 0.88]);

  const springTitle = useSpring(titleY, { stiffness: 60, damping: 20 });
  const springOpacity = useSpring(opacity, { stiffness: 60, damping: 20 });
  const springScale = useSpring(scale, { stiffness: 60, damping: 20 });
  const springSubtitle = useSpring(subtitleY, { stiffness: 60, damping: 20 });

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden"
    >
      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full bg-white/5 blur-2xl" />
      <div className="absolute -bottom-32 -left-32 w-72 h-72 sm:w-96 sm:h-96 md:w-[500px] md:h-[500px] rounded-full bg-white/5 blur-3xl" />

      <motion.div
        className="relative z-10 text-center px-4 sm:px-6 md:px-8 max-w-5xl mx-auto w-full"
        style={{ y: springTitle, opacity: springOpacity, scale: springScale }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-5 sm:mb-8"
        >
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-300 animate-pulse" />
          <span className="text-[#fdfbf7]/80 text-[10px] sm:text-xs md:text-sm tracking-widest uppercase font-medium">
            Expo KKN 064 Giling
          </span>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-[#fdfbf7] leading-[1.1] tracking-tight mb-4 sm:mb-6"
        >
          Program{' '}
          <span className="italic bg-gradient-to-r from-emerald-200 via-lime-200 to-teal-200 bg-clip-text text-transparent">
            Kerja
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.div style={{ y: springSubtitle }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-[#fdfbf7]/70 text-sm sm:text-base md:text-lg lg:text-xl font-light max-w-xl sm:max-w-2xl mx-auto leading-relaxed px-2"
          >
            Padukuhan Giling · Desa Tuksono · Sentolo · Kulon Progo
          </motion.p>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-10 sm:mt-16"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2 sm:gap-3"
          >
            <span className="text-[#fdfbf7]/40 text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] uppercase">
              Scroll untuk menjelajahi
            </span>
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-[#fdfbf7]/40"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Auto-Play Video (muted, loop, play saat di-scroll)

   Strategi:
   - YouTube → embed player dengan autoplay=1 mute=1 loop=1 (paling reliable)
   - Google Drive → iframe preview (autoplay tapi tidak bisa loop)
   - URL langsung (.mp4 dll) → <video> tag dengan autoplay muted loop

   pointer-events: none pada iframe memastikan user TIDAK BISA klik
   unmute atau pause — video tetap MUTED selamanya.
   ═══════════════════════════════════════════════════════════════ */

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  // youtube.com/watch?v=ID atau youtu.be/ID
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function AutoPlayVideo({ proker }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const url = proker.media;
  const youtubeId = extractYouTubeId(url);
  const driveFileId = extractDriveFileId(url);
  const isDirectVideo = !youtubeId && !driveFileId;

  // IntersectionObserver — tampilkan iframe hanya saat terlihat
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1, rootMargin: '1200px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // === YouTube (BEST: autoplay + muted + loop + no controls) ===
  if (youtubeId) {
    const ytUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`;
    return (
      <div ref={containerRef} className="aspect-square bg-black overflow-hidden relative">
        {isVisible && (
          <iframe
            src={ytUrl}
            title={proker.nama}
            className="absolute inset-0 w-[300%] h-[300%] -top-[100%] -left-[100%] border-0 pointer-events-none"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}

      </div>
    );
  }

  // === Google Drive (autoplay via iframe, muted via pointer-events:none) ===
  if (driveFileId) {
    const driveUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
    const thumbnailUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;

    return (
      <div ref={containerRef} className="aspect-square bg-black overflow-hidden relative">
        {/* Thumbnail saat belum visible */}
        {!isVisible && (
          <img
            src={thumbnailUrl}
            alt={proker.nama}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}

        {/* iframe — pointer-events:none = user TIDAK BISA klik unmute */}
        {isVisible && (
          <iframe
            src={driveUrl}
            title={proker.nama}
            className="absolute inset-0 w-[180%] h-[180%] -top-[40%] -left-[40%] border-0 pointer-events-none"
            allow="autoplay; encrypted-media"
          />
        )}


      </div>
    );
  }

  // === Direct video URL (.mp4, .webm, dll) ===
  if (isDirectVideo) {
    return <DirectVideo url={url} nama={proker.nama} containerRef={containerRef} />;
  }

  return null;
}

/** Direct <video> untuk URL langsung (.mp4 dll) — autoplay muted loop */
function DirectVideo({ url, nama, containerRef }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return (
    <div ref={containerRef} className="aspect-square bg-black overflow-hidden relative">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Media Renderer (Foto & Video)
   ═══════════════════════════════════════════════════════════════ */

function MediaRenderer({ proker }) {
  const isVideo = proker.tipe?.toLowerCase() === 'video';

  if (isVideo && proker.media) {
    return <AutoPlayVideo proker={proker} />;
  }

  return (
    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden relative">
      {proker.media ? (
        <img
          src={proker.media}
          alt={proker.nama}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
          }}
        />
      ) : null}
      {/* Fallback placeholder */}
      <div
        className={`absolute inset-0 ${proker.media ? 'hidden' : 'flex'} items-center justify-center bg-gradient-to-br from-[#7ba084]/20 to-[#b3d4b6]/30`}
      >
        <svg className="w-10 h-10 sm:w-14 sm:h-14 text-[#7ba084]/40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Modal Video (handle YouTube, Drive, direct URL)
   ═══════════════════════════════════════════════════════════════ */

function ModalVideo({ url, nama }) {
  const youtubeId = extractYouTubeId(url);
  const driveFileId = extractDriveFileId(url);

  // YouTube → embed player
  if (youtubeId) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
        title={nama}
        className="w-full h-full border-0"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    );
  }

  // Google Drive → preview iframe
  if (driveFileId) {
    return (
      <iframe
        src={`https://drive.google.com/file/d/${driveFileId}/preview`}
        title={nama}
        className="w-full h-full border-0"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    );
  }

  // Direct URL → <video> tag
  return (
    <video
      src={url}
      className="w-full h-full object-contain"
      controls
      autoPlay
      playsInline
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Detail Modal (untuk deskripsi lengkap)
   ═══════════════════════════════════════════════════════════════ */

function DetailModal({ proker, onClose }) {
  const isVideo = proker.tipe?.toLowerCase() === 'video';

  // Close on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative bg-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Media */}
        {proker.media && (
          <div className="w-full aspect-video bg-gray-900">
            {isVideo ? (
              <ModalVideo url={proker.media} nama={proker.nama} />
            ) : (
              <img
                src={proker.media}
                alt={proker.nama}
                className="w-full h-full object-contain bg-gray-100"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        )}

        {/* Text Content */}
        <div className="p-5 sm:p-6">
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-3">
            {proker.nama}
          </h3>
          {proker.deskripsi && (
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
              {proker.deskripsi}
            </p>
          )}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium uppercase tracking-wider">
              {proker.kategori === 'Utama' && '🎯'}
              {proker.kategori === 'Pendukung' && '🤝'}
              {proker.kategori === 'Individu' && '🌱'}
              Program Kerja {proker.kategori}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Polaroid Card dengan Scroll Animation
   ═══════════════════════════════════════════════════════════════ */

function PolaroidCard({ proker, index, direction = 'left', onOpen }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.2, once: false });

  const rotation = useMemo(() => {
    const seed = (index * 7 + 3) % 13;
    return (seed - 6) * 1.0;
  }, [index]);

  const hoverRotation = rotation > 0 ? rotation + 2 : rotation - 2;
  const slideX = direction === 'left' ? -60 : 60;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: slideX, y: 50, rotate: rotation + (direction === 'left' ? -8 : 8) }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0, rotate: rotation }
          : { opacity: 0, x: slideX, y: 50, rotate: rotation + (direction === 'left' ? -8 : 8) }
      }
      whileHover={{
        rotate: hoverRotation,
        scale: 1.04,
        y: -6,
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }}
      transition={{
        duration: 0.6,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="group cursor-pointer"
      onClick={() => onOpen(proker)}
    >
      <div
        className="bg-white rounded-sm overflow-hidden relative flex flex-col"
        style={{
          boxShadow:
            '0 20px 40px -10px rgba(0,0,0,0.22), 0 8px 20px -6px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {/* Media area */}
        <div className="p-1.5 sm:p-2 md:p-2.5 pb-0">
          <MediaRenderer proker={proker} />
        </div>

        {/* Caption Area */}
        <div className="px-2.5 sm:px-3 md:px-4 py-2.5 sm:py-3 md:py-4 flex-1">
          <h3 className="font-serif text-xs sm:text-sm md:text-base font-semibold text-gray-800 leading-snug">
            {proker.nama}
          </h3>
          {proker.deskripsi && (
            <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 mt-1 sm:mt-1.5 leading-relaxed">
              {proker.deskripsi}
            </p>
          )}
        </div>

        {/* Tape decoration */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 sm:w-10 sm:h-4 md:w-12 md:h-5 bg-yellow-100/60 backdrop-blur-sm rotate-1 border border-yellow-200/30" />

        {/* Hover overlay "Lihat Detail" */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100">
          <span className="text-white text-[10px] sm:text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
            Lihat Detail
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Section Kategori Proker
   ═══════════════════════════════════════════════════════════════ */

function ProkerSection({ title, subtitle, icon, prokerList, sectionIndex, onOpenDetail }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.1, once: false });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const springBgY = useSpring(backgroundY, { stiffness: 50, damping: 20 });

  const themes = [
    {
      badge: 'bg-emerald-400/20 text-emerald-100 border-emerald-400/30',
      accent: '#4ade80',
      number: 'text-emerald-300/10',
    },
    {
      badge: 'bg-teal-400/20 text-teal-100 border-teal-400/30',
      accent: '#2dd4bf',
      number: 'text-teal-300/10',
    },
    {
      badge: 'bg-lime-400/20 text-lime-100 border-lime-400/30',
      accent: '#a3e635',
      number: 'text-lime-300/10',
    },
  ];

  const theme = themes[sectionIndex % themes.length];

  return (
    <section ref={ref} className="relative min-h-[80svh] py-16 sm:py-20 md:py-28 lg:py-32 overflow-hidden">
      {/* Big background number */}
      <motion.div
        className={`absolute -left-4 sm:-left-8 top-8 sm:top-12 font-serif text-[120px] sm:text-[180px] md:text-[250px] lg:text-[300px] font-black ${theme.number} select-none pointer-events-none leading-none`}
        style={{ y: springBgY }}
      >
        {sectionIndex + 1}
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-10 sm:mb-14 md:mb-18 lg:mb-20"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 0.5, delay: 0.15, type: 'spring' }}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border text-[10px] sm:text-xs tracking-widest uppercase font-medium mb-4 sm:mb-6 ${theme.badge}`}
          >
            {icon}
            <span>{subtitle}</span>
          </motion.span>

          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-[#fdfbf7] leading-tight">
            {title}
          </h2>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-4 sm:mt-6 h-0.5 w-16 sm:w-20 md:w-24 origin-left"
            style={{ backgroundColor: theme.accent }}
          />
        </motion.div>

        {/* Polaroid Grid — Responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-8">
          {prokerList.map((proker, i) => (
            <PolaroidCard
              key={`${proker.nama}-${i}`}
              proker={proker}
              index={i}
              direction={i % 2 === 0 ? 'left' : 'right'}
              onOpen={onOpenDetail}
            />
          ))}
        </div>

        {prokerList.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            className="text-center py-16 sm:py-20"
          >
            <p className="text-[#fdfbf7]/40 text-base sm:text-lg font-serif italic">
              Belum ada program kerja di kategori ini
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KOMPONEN — Footer Section
   ═══════════════════════════════════════════════════════════════ */

function ExpoFooter() {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.4, once: false });

  return (
    <section ref={ref} className="relative min-h-[40svh] sm:min-h-[50vh] flex items-center justify-center overflow-hidden py-16">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
        className="text-center px-4 sm:px-6"
      >
        <p className="text-[#fdfbf7]/30 text-[10px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] uppercase mb-3 sm:mb-4">
          KKN 064 · UPN Veteran Yogyakarta
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#fdfbf7]/80 mb-3 sm:mb-4">
          Giling Gemilang
        </h2>
        <p className="text-[#fdfbf7]/40 text-xs sm:text-sm max-w-sm sm:max-w-md mx-auto leading-relaxed">
          Padukuhan Giling, Desa Tuksono, Kecamatan Sentolo, Kabupaten Kulon Progo, D.I. Yogyakarta
        </p>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-6 sm:mt-8 h-px w-24 sm:w-32 mx-auto bg-gradient-to-r from-transparent via-[#fdfbf7]/20 to-transparent"
        />

        <p className="text-[#fdfbf7]/20 text-[10px] sm:text-xs mt-4 sm:mt-6">
          © 2025 KKN 064 Giling — Universitas Pembangunan Nasional Veteran Yogyakarta
        </p>
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HALAMAN UTAMA — Expo Banner
   ═══════════════════════════════════════════════════════════════ */

export default function ExpoBanner() {
  const [prokerData, setProkerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProker, setSelectedProker] = useState(null);

  const handleOpenDetail = useCallback((proker) => {
    setSelectedProker(proker);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedProker(null);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    async function fetchProker() {
      if (!API_CONFIG.proker) {
        setProkerData(FALLBACK_PROKER);
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

        setProkerData(mapped.length > 0 ? mapped : FALLBACK_PROKER);
      } catch (err) {
        console.error('⚠️ Gagal memuat data proker:', err);
        setError(err.message);
        setProkerData(FALLBACK_PROKER);
      } finally {
        setLoading(false);
      }
    }

    fetchProker();
  }, []);

  const prokerUtama = prokerData.filter((p) => p.kategori?.toLowerCase() === 'utama');
  const prokerPendukung = prokerData.filter((p) => p.kategori?.toLowerCase() === 'pendukung');
  const prokerIndividu = prokerData.filter((p) => p.kategori?.toLowerCase() === 'individu');

  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-[#5a7d62] via-[#7ba084] to-[#8fb596]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-4"
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 border-[3px] border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4 sm:mb-6" />
          <p className="text-[#fdfbf7]/70 font-serif text-base sm:text-xl tracking-wide">
            Memuat Program Kerja...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-[#5a7d62] via-[#7ba084] to-[#8fb596] min-h-[100svh] overflow-x-hidden">
      <FloatingParticles />

      {/* Fixed gradient overlays */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06)_0%,_transparent_60%)] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(0,0,0,0.12)_0%,_transparent_60%)] pointer-events-none z-0" />

      {/* Noise texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <HeroSection />

        {/* API notice */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6 sm:-mt-8 mb-6 sm:mb-8">
            <div className="bg-yellow-400/10 backdrop-blur-sm border border-yellow-400/20 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 text-yellow-200/80 text-xs sm:text-sm text-center">
              ⚠️ Menggunakan data contoh — Konfigurasi Spreadsheet ID di{' '}
              <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] sm:text-xs">apiConfig.js</code>
            </div>
          </div>
        )}

        <div className="max-w-[200px] sm:max-w-xs mx-auto h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4 sm:mb-8" />

        {prokerUtama.length > 0 && (
          <ProkerSection
            title="Program Kerja Utama"
            subtitle="Proker Utama"
            icon="🎯"
            prokerList={prokerUtama}
            sectionIndex={0}
            onOpenDetail={handleOpenDetail}
          />
        )}

        {prokerPendukung.length > 0 && (
          <ProkerSection
            title="Program Kerja Pendukung"
            subtitle="Proker Pendukung"
            icon="🤝"
            prokerList={prokerPendukung}
            sectionIndex={1}
            onOpenDetail={handleOpenDetail}
          />
        )}

        {prokerIndividu.length > 0 && (
          <ProkerSection
            title="Program Kerja Individu"
            subtitle="Proker Individu"
            icon="🌱"
            prokerList={prokerIndividu}
            sectionIndex={2}
            onOpenDetail={handleOpenDetail}
          />
        )}

        <ExpoFooter />
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedProker && (
          <DetailModal proker={selectedProker} onClose={handleCloseDetail} />
        )}
      </AnimatePresence>
    </div>
  );
}
