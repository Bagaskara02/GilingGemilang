/**
 * ═══════════════════════════════════════════════════════════════
 *  KONFIGURASI API — Google Sheets untuk Expo Banner Proker
 * ═══════════════════════════════════════════════════════════════
 *
 *  CARA SETUP:
 *
 *  1. Buka Google Spreadsheet Anda di browser.
 *  2. Klik  File → Share → Publish to web → Klik "Publish".
 *  3. Copy Spreadsheet ID dari URL browser Anda:
 *     https://docs.google.com/spreadsheets/d/[INI_SPREADSHEET_ID]/edit
 *  4. Paste ID tersebut di variabel PROKER_SPREADSHEET_ID di bawah.
 *
 *  FORMAT KOLOM SPREADSHEET:
 *  | Nama | Deskripsi | Link | Kategori | Tipe |
 *
 *  - Kategori: Utama / Pendukung / Individu
 *  - Tipe: Foto / Video (opsional, default: Foto)
 *  - Link: URL Google Drive (format drive.google.com/file/d/...) atau URL video/gambar langsung
 *
 * ═══════════════════════════════════════════════════════════════
 */

// ┌───────────────────────────────────────────────────────────┐
// │  SPREADSHEET ID UNTUK DATA PROGRAM KERJA (PROKER)         │
// └───────────────────────────────────────────────────────────┘
const PROKER_SPREADSHEET_ID = '1uzs690dAT2vsaLEsbjaK5Gk5nRTQ5Pt1FpcF_gTj8rU';
const SHEET_PROKER = 'Proker064';

/**
 * Membangun URL Google Sheets gviz/tq untuk mengambil data.
 */
function buildGoogleSheetsUrl(spreadsheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`;
}

const isConfigured = PROKER_SPREADSHEET_ID !== 'PASTE_PROKER_SPREADSHEET_ID_DISINI';

export const API_CONFIG = {
  /**
   * URL untuk data program kerja.
   * Kolom: Nama | Deskripsi | Link | Kategori | Tipe
   */
  proker: isConfigured ? buildGoogleSheetsUrl(PROKER_SPREADSHEET_ID, SHEET_PROKER) : null,
  };
