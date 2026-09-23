# WedPlan — Wedding Planner PWA

**Produk oleh:** Nexus Diji · **PRD:** [`PRD-WedPlan.md`](./PRD-WedPlan.md) · **Status:** MVP Fase 1–7 selesai (live setelah deploy — lihat [#7 Deploy ke Vercel](#7-deploy-ke-vercel))

WedPlan membantu calon pengantin mengelola **checklist, budget, dan vendor** pernikahan dari satu dashboard — berupa PWA yang bisa di-install di Android & iOS.

## Daftar Isi

1. [Ringkasan Fitur (mapping FR)](#1-ringkasan-fitur)
2. [Tech Stack](#2-tech-stack)
3. [Menjalankan Lokal](#3-menjalankan-lokal)
4. [Struktur Proyek](#4-struktur-proyek)
5. [Skema Data](#5-skema-data)
6. [Keamanan (Security Rules) & Uji Isolasi](#6-keamanan-security-rules--uji-isolasi)
7. [Deploy ke Vercel](#7-deploy-ke-vercel)
8. [PWA (Manifest, Service Worker, Offline)](#8-pwa-manifest-service-worker-offline)
9. [Pemeliharaan (Handover)](#9-pemeliharaan-handover)
10. [Checklist Verifikasi (Definition of Done)](#10-checklist-verifikasi-definition-of-done)
11. [Future Enhancement (di luar MVP)](#11-future-enhancement-di-luar-mvp)

---

## 1. Ringkasan Fitur

| Modul | FR | Isi |
|---|---|---|
| Autentikasi | FR-01 | Daftar/masuk Email-PPassword (validasi email & password ≥8 karakter) + Google |
| Onboarding | FR-02, FR-03 | Wizard 3 langkah (nama pasangan → tanggal → lokasi) → auto-generate **19 tugas checklist default**; data bisa diedit ulang di **Pengaturan** |
| Dashboard | FR-04…07 | Countdown hari-H, % checklist, budget terpakai vs alokasi (indikator warna), jumlah vendor per status |
| Checklist | FR-08…11 | 9 kategori default; CRUD item (judul/kategori/due date opsional/status); progress per kategori & total; **realtime** (tanpa tombol "save") |
| Budget | FR-12…16 | Total budget (edit kapan saja); alokasi per kategori via **nominal atau persentase**; pengeluaran + **foto struk → Firebase Storage**; chart Recharts **alokasi vs realisasi**; warna hijau <70% / kuning 70–99% / merah ≥100% |
| Vendor | FR-17…19 | Field lengkap + alur status Dihubungi→Nego→Deal→DP→Lunas; **dua mode tampilan**: list (sortable) & timeline (urut deadline); badge **H-7 / H-3 / H-1** + "Terlambat"/"Hari ini" |
| PWA | FR-20…23 | Manifest lengkap (standalone, ikon 192/512/maskable), service worker + halaman `/offline`, responsive mobile-first |

**Di luar cakupan MVP** (dicatat, tidak diimplementasikan): kolaborasi 2 akun, push FCM, integrasi undangan, marketplace vendor, role wedding organizer, payment gateway → lihat [Future Enhancement](#11-future-enhancement-di-luar-mvp).

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | **Next.js 16.3.6** (App Router, Turbopack untuk build; dev dikunci `--webpack`) · **React 19.2** · TypeScript |
| Styling | **Tailwind CSS v4** |
| Animasi | **Framer Motion 13** dengan `MotionConfig reducedMotion="user"` (aksesibilitas) |
| Backend | **Firebase 12**: Authentication, Firestore (realtime), Storage |
| Chart | **Recharts 3** |
| Hosting | **Vercel** · PWA: service worker native (`public/sw.js`) |

## 3. Menjalankan Lokal

**Prasyarat:** Node.js 20+ dan npm.

```bash
npm install
cp .env.local.example .env.local    # Windows: salin manual
npm run dev                          # = next dev --webpack → http://localhost:3000
```

> ⚠️ **Selalu pakai `npm run dev`** (script-nya memaksa `--webpack`). Mode Turbopack (default `next dev` di Next 16) punya bug cache CSS saat pengembangan.

### Konfigurasi Firebase (wajib untuk data sungguhan)

1. [Firebase Console](https://console.firebase.google.com) → project kamu → **Project settings → Your apps → SDK setup and configuration** → salin 6 nilai ke `.env.local` (`NEXT_PUBLIC_FIREBASE_*`).
2. **Authentication → Sign-in method** → aktifkan **Email/Password** dan **Google**.
3. **Firestore Database → Create database** (production mode, region terdekat).
4. **Storage → Get started**.

Selama `.env.local` masih kosong, aplikasi tetap bisa dibuka — semua halaman menampilkan **empty state / pesan "Firebase belum dikonfigurasi"** yang jelas (tanpa crash).

### Script npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server (`next dev --webpack`) |
| `npm run build` / `npm start` | Build produksi / jalankan hasil build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript `--noEmit` |
| `npm run icons` | Regenerate ikon PWA dari `scripts/generate-icons.mjs` |

## 4. Struktur Proyek

```
app/
  layout.tsx                 # Root: metadata PWA, font, themeColor
  manifest.ts                # Web App Manifest (FR-20)
  offline/page.tsx           # Fallback offline (FR-21)
  (auth)/login, register     # Guard: GuestGuard (sudah login → dashboard/onboarding)
  (setup)/onboarding         # Guard: login saja (FR-02)
  (app)/dashboard|checklist|budget|vendors|settings   # Guard: login + onboarded
components/
  ui/                        # Kit reusable: button, card, input, select, number-input,
                             # modal, progress-bar, badge, spinner, skeleton, empty-state
  dashboard|checklist|budget|vendors|onboarding|settings   # Per modul
  layout/app-shell.tsx       # Header + nav (daftar menu: NAV_ITEMS)
  providers/app-providers.tsx# MotionConfig reducedMotion + AuthProvider + SwRegister
lib/
  firebase.ts                # Lazy init Firebase + isFirebaseConfigured
  constants.ts               # SINGLE SOURCE: kategori, status vendor, ambang warna
  aggregate.ts               # Statistik checklist/budget/vendor (dipakai dashboard & modul)
  collection-paths.ts        # Path Firestore (string) — satu tempat
  default-checklist.ts       # Template 19 tugas default (FR-02/FR-08)
  *-service.ts               # Tulis-baca Firestore/Storage per modul
  hooks/                     # auth-context, auth-guard, guest-guard, use-collection (realtime)
scripts/
  generate-icons.mjs         # Generator PNG ikon (tanpa dependensi)
  test-rules-isolation.mjs   # Uji isolasi rules A vs B (lihat bagian 6)
public/sw.js                 # Service worker (FR-21)
firestore.rules, storage.rules, firebase.json
```

## 5. Skema Data

Sesuai PRD Section 8 (Firestore):

```
users/{userId}
  - email, displayName, partnerName, weddingDate, venue, createdAt
  - totalBudget*            (*field tambahan FR-12 — lihat catatan di bawah)

users/{userId}/checklist/{itemId}
  - title, category, dueDate, isCompleted, createdAt

users/{userId}/budget/{categoryId}
  - categoryName, allocatedAmount, expenses: [{ description, amount, date, receiptUrl }]

users/{userId}/vendors/{vendorId}
  - name, category, contact, status, dealAmount, paymentDeadline, notes, createdAt
```

**Catatan implementasi:**

- `totalBudget` (FR-12) — PRD tidak menentukan lokasi penyimpanan total budget, maka disimpan sebagai **field tambahan** di `users/{userId}`, sesuai NFR "struktur siap ditambah field baru tanpa migrasi". `venue`/`weddingDate` dikosongkan lagi = user belum onboarding (dipakai guard `/onboarding`).
- `categoryId` = **slug determinik** dari nama kategori (mis. `Legal/Dokumen` → `legal-dokumen`) sehingga alokasi selalu upsert, tidak pernah menggandakan dokumen.
- Item `expenses` diedit berbasis **index** dalam array (skema persis PRD, tanpa id per-transaksi) — aman untuk single-user.
- **Storage:** struk di `users/{uid}/receipts/{timestamp}-{nama}`, maks **5 MB** (divalidasi di aplikasi *dan* rules).

## 6. Keamanan (Security Rules) & Uji Isolasi

**Prinsip: owner-only, default deny.** `firestore.rules` hanya membuka `users/{ownUserId}/**` untuk `request.auth.uid == userId` — path lain otomatis ditolak. `storage.rules` memisahkan `read` / `write` (maks 5 MB) / `delete`, semuanya owner-only.

> Rules dipisah per operasi karena `request.resource` bernilai `null` saat READ/DELETE — menggabungkannya dengan `request.resource.size` akan menolak operasi tersebut.

### Deploy rules

```bash
npm install -g firebase-tools   # atau pakai npx
firebase login
firebase deploy --only firestore:rules,storage
```

### Uji isolasi (syarat DoD — user A tidak bisa akses data user B)

**Jalur A — otomatis (emulator; butuh Java 17+):**

```bash
npx firebase-tools emulators:exec --only auth,firestore,storage \
  --project demo-wedplan "node scripts/test-rules-isolation.mjs --emulator"
```

**Jalur B — proyek asli (setelah rules di-deploy):**

```bash
# isi .env.local dulu, lalu:
node scripts/test-rules-isolation.mjs
```

Skrip menguji 10+ skenario: A akses data sendiri (wajib lolos), akses tanpa login, B membaca/menulis/menghapus data A, dan B mengunggah struk ke folder A — semuanya wajib `DENY`. Keluaran `PASS/FAIL` per skenario, exit code ≠ 0 bila gagal. Jalur B membuat 2 akun uji `rules-test-*@example.com` (dokumen dibersihkan otomatis; akun bisa dihapus via Console → Authentication).

**Jalur manual (tanpa alat):** Firebase Console → Firestore → **Rules → Testing tab** → simulasi `uid: userA` pada dokumen `users/userB/...` → hasil wajib **DENY**; atau dua browser (normal + incognito) dengan dua akun berbeda.

## 7. Deploy ke Vercel

1. Push repo ini ke GitHub/GitLab.
2. [vercel.com/new](https://vercel.com/new) → import repo → preset **Next.js** terdeteksi otomatis (build: `next build`).
3. Isi **Environment Variables** (Production *dan* Preview):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`
   - `NEXT_PUBLIC_APP_URL=https://<domain-kamu>` (untuk URL absolut manifest/PWA).
4. **Deploy** → dapatkan domain (mis. `wedplan.vercel.app` atau domain sendiri).
5. Firebase Console → Authentication → **Settings → Authorized domains** → tambahkan domain Vercel (wajib untuk login Google).
6. Deploy rules ke Firebase (bagian [6](#6-keamanan-security-rules--uji-isolasi)) **sebelum** user pertama mendaftar.
7. Uji live: daftar → onboarding → isi 3 modul → install PWA (bagian 10).

## 8. PWA (Manifest, Service Worker, Offline)

| File | Peran |
|---|---|
| `app/manifest.ts` | Manifest: `name/short_name`, `start_url: /dashboard`, `display: standalone`, `theme_color: #e11d48`, ikon 192 + 512 + maskable |
| `public/icons/*` | Ikon hasil `npm run icons` (hati rose, prosedural) + `apple-touch-icon` 180px (ada juga salinan di root `/apple-touch-icon.png` untuk fallback iOS) |
| `public/sw.js` | Service worker: **navigasi network-first → cache → `/offline`**; `/_next/static/*` cache-first; lainnya stale-while-revalidate; **cross-origin (Firebase) tidak di-cache**; precache 10 route + manifest |
| `components/providers/sw-register.tsx` | Registrasi SW **hanya di production** (dev sengaja tanpa SW agar tidak kena cache stale) |
| `next.config.ts` | Header `/sw.js`: `Cache-Control: no-cache` + `Service-Worker-Allowed: /` |

**Perilaku offline:** halaman yang pernah dibuka → tampil dari cache; halaman belum pernah dibuka → halaman `/offline` yang informatif; data Firebase tetap butuh koneksi.

**Meng-update SW:** ubah nilai `VERSION` di `public/sw.js` lalu deploy — browser otomatis buang cache lama saat `activate`.

**Install — Android:** Chrome → menu ⋮ → *Add to Home screen* / banner install.
**Install — iOS (batasan, sesuai risiko PRD):** Safari → *Bagikan* → *Tambahkan ke Layar Utama*. iOS tidak menampilkan banner install otomatis dan punya perilaku A2HS yang berbeda dari Android — **uji manual di device fisik**, jangan asumsikan parity.

## 9. Pemeliharaan (Handover)

| Kebutuhan | Lokasi |
|---|---|
| Tambah/ubah **kategori** (checklist/budget/vendor seragam) | `lib/constants.ts` → `CHECKLIST_CATEGORIES` (satu sumber, semua modul ikut) |
| Ubah **template checklist default** | `lib/default-checklist.ts` (`title`, `category`, `daysBeforeWedding`) — hanya berlaku untuk onboarding berikutnya; tidak mengubah data user lama (anti-duplikat) |
| Ambang **warna budget** (FR-16) | `lib/constants.ts` → `BUDGET_THRESHOLDS` (hijau <70%, kuning 70–99%, merah ≥100%) |
| **Status vendor** & urutan alur | `lib/constants.ts` → `VENDOR_STATUSES`, `VENDOR_STATUS_LABELS`, `VENDOR_STATUS_TONES` |
| **Tema warna** | `app/layout.tsx` (`themeColor`), `app/globals.css`, `BACKGROUND` di `scripts/generate-icons.mjs` (lalu `npm run icons`) |
| Menu navigasi | `components/layout/app-shell.tsx` → `NAV_ITEMS` |
| Upgrade Next.js | Baca dokumen lokal `node_modules/next/dist/docs/` (versi ini punya breaking changes besar) |
| Monitoring | Firebase Console → Usage & billing (atur alert free tier) · Vercel → Logs/Analytics |

**Troubleshooting**

| Gejala | Penyebab & solusi |
|---|---|
| Banner "Firebase belum dikonfigurasi" | `.env.local` kosong → isi 6 nilai, restart dev |
| `permission-denied` di browser console | Rules belum ke-deploy / akses lintas user (ini benar!) → `firebase deploy --only firestore:rules,storage` |
| Login Google gagal (popup) | Domain belum di *Authorized domains*, atau popup diblokir |
| Tampilan CSS aneh di dev | Pastikan `npm run dev` (webpack), bukan `next dev` biasa |
| Halaman offline terus-muncul padahal online | Buka DevTools → Application → Service Workers → *Unregister*, atau bump `VERSION` |
| Struk gagal diunggah | Ukuran >5 MB, Storage belum aktif, atau `storage.rules` belum di-deploy |

## 10. Checklist Verifikasi (Definition of Done)

- [ ] **Lighthouse — installability 100%**: buka URL **production** (bukan dev) di Chrome → DevTools → Lighthouse → centang *Progressive Web App* → Generate report → pastikan **Installable: Yes** / skor 100.
- [ ] **Install Android**: Chrome → *Add to Home screen* → buka dari home screen → cek ikon, splash, navigasi.
- [ ] **Install iOS**: Safari → *Bagikan → Tambahkan ke Layar Utama* → buka dari home screen → cek `apple-touch-icon` & tampilan standalone.
- [ ] **Offline**: buka beberapa halaman → matikan data → reload → halaman yang pernah dibuka tetap tampil; halaman baru menampilkan `/offline`.
- [ ] **3 modul tanpa bug kritis**:
  - [ ] Onboarding baru → 19 tugas default muncul; edit data di Pengaturan → countdown dashboard ikut berubah.
  - [ ] Checklist: tambah/ubah/hapus/toggle → langsung tersimpan (buka tab kedua → sinkron realtime); progress per kategori & total benar.
  - [ ] Budget: set total → alokasi % dan Rp → catat pengeluaran + struk → chart & warna sesuai ambang; sisa budget benar.
  - [ ] Vendor: 2 mode tampilan; deadline 7/3/1 hari ke depan menampilkan badge H-7/H-3/H-1; status berpindah tahap.
- [ ] **Rules isolation PASS** (jalur A/B/manual di [bagian 6](#6-keamanan-security-rules--uji-isolasi)).
- [ ] **Live** di domain Vercel dengan Firebase aktif (URL dicatat di sini setelah deploy).

## 11. Future Enhancement (di luar MVP)

Sesuai PRD (Out-of-Scope + Roadmap Fase 2) — **belum dan tidak boleh diimplementasikan di MVP ini**:

1. Kolaborasi realtime **2 akun pasangan** dalam 1 data pernikahan.
2. **Push notification** reminder deadline (Firebase Cloud Messaging).
3. **Integrasi** ke produk wedding invitation Nexus Diji (satu akun untuk keduanya / cross-sell).
4. **Vendor marketplace / direktori** vendor pihak ketiga.
5. Mode **wedding organizer** (multi-client, role planner).
6. **Payment gateway** / transaksi di dalam aplikasi.

**Catatan keputusan implementasi** (kandidat perbaikan fase 2, bukan fitur baru):

- `totalBudget` disimpan di `users/{userId}` — lokasi tidak dispesifikasi PRD untuk FR-12.
- Service worker **native** (`public/sw.js`) alih-alih `next-pwa` — PRD mengizinkan keduanya; plugin `next-pwa` tidak kompatibel dengan toolchain Next 16.
- Proteksi rute via **layout guard** (`AuthGuard`/`GuestGuard`) alih-alih `proxy.ts` — sesi Firebase hidup di IndexedDB client dan tidak bisa diverifikasi dari runtime server/edge.
- Chart memakai **bar** (PRD mengizinkan "donut/bar") — bar horizontal agar label kategori terbaca di layar sempit.
- `expenses` diedit berbasis index (skema tanpa id per-transaksi) → bila kelak butuh audit trail, tambahkan `id` per item sebagai field baru (tanpa migrasi).
- Ikon PWA digenerate **prosedural** (hati rose) — ganti dengan aset desain bila tersedia (`npm run icons` setelah mengubah generator).
