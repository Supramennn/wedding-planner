# WedPlan — Wedding Planner PWA

**Produk oleh:** Nexus Diji · **PRD:** [`PRD-WedPlan.md`](./PRD-WedPlan.md) · **Status:** MVP Fase 1–7 + **Fase 2 (kolaborasi pasangan & reminder FCM)**

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
| Kolaborasi (Fase 2) | — | **2 akun pasangan dalam satu data pernikahan** (`weddings/{id}`): undang pasangan via **kode undangan** (sekali pakai, Callable `joinWedding`); label "A & B" di dashboard; migrasi otomatis data akun lama |
| Reminder (Fase 2) | — | **Push notification FCM** deadline checklist & pembayaran vendor (H-7/H-3/H-1/hari ini) via Cloud Function terjadwal; aktif/nonaktif per device di Pengaturan |

**Di luar cakupan** (dicatat, tidak diimplementasikan): integrasi undangan, marketplace vendor, role wedding organizer, payment gateway → lihat [Future Enhancement](#11-future-enhancement-di-luar-mvp).

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | **Next.js 16.3.6** (App Router, Turbopack untuk build; dev dikunci `--webpack`) · **React 19.2** · TypeScript |
| Styling | **Tailwind CSS v4** |
| Animasi | **Framer Motion 13** dengan `MotionConfig reducedMotion="user"` (aksesibilitas) |
| Backend | **Firebase 12**: Authentication, Firestore (realtime), Storage, **Cloud Messaging (FCM)** |
| Functions | **Firebase Cloud Functions** (v2): `joinWedding` callable + `scheduledDeadlineReminder` (nodejs 22) |
| Chart | **Recharts 3** |
| Hosting | **Vercel** · PWA: service worker disuntik via `app/sw.js/route.ts` |

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
5. *(Fase 2, opsional)* **Project settings → Cloud Messaging → Web Push certificates** → salin *Key pair* ke `NEXT_PUBLIC_FIREBASE_VAPID_KEY` di `.env.local`.
6. *(Fase 2, wajib untuk kolaborasi & reminder)* Deploy Cloud Functions — lihat [Deploy Cloud Functions](#deploy-cloud-functions-fase-2) di bawah.

Selama `.env.local` masih kosong, aplikasi tetap bisa dibuka — semua halaman menampilkan **empty state / pesan "Firebase belum dikonfigurasi"** yang jelas (tanpa crash). Tanpa VAPID key, app tetap jalan tetapi kartu **Pengingat** nonaktif.

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
  sw.js/route.ts             # Service worker + config FCM (route handler, en-dinamis)
  offline/page.tsx           # Fallback offline (FR-21)
  (auth)/login, register     # Guard: GuestGuard (sudah login → dashboard/onboarding)
  (setup)/onboarding         # Guard: login saja (FR-02) + join via kode undangan
  (app)/dashboard|checklist|budget|vendors|settings   # Guard: login + onboarded
components/
  ui/                        # Kit reusable: button, card, input, select, number-input,
                             # modal, progress-bar, badge, spinner, skeleton, empty-state
  dashboard|checklist|budget|vendors|onboarding|settings   # Per modul
  layout/app-shell.tsx       # Header + nav (daftar menu: NAV_ITEMS)
  providers/app-providers.tsx# MotionConfig reducedMotion + AuthProvider + SwRegister
lib/
  firebase.ts                # Lazy init Firebase + isFirebaseConfigured + isFCMConfigured
  constants.ts               # SINGLE SOURCE: kategori, status vendor, ambang warna
  aggregate.ts               # Statistik checklist/budget/vendor (dipakai dashboard & modul)
  collection-paths.ts        # Path Firestore/Storage (weddings/{id}/... + jalur legacy)
  wedding-service.ts         # create/migrasi/join pernikahan bersama (Fase 2)
  fcm-service.ts             # izin notifikasi + token perangkat (Fase 2)
  default-checklist.ts       # Template 19 tugas default (FR-02/FR-08)
  *-service.ts               # Tulis-baca Firestore/Storage per modul
  hooks/                     # auth-context, auth-guard, guest-guard, use-collection (realtime)
scripts/
  generate-icons.mjs         # Generator PNG ikon (tanpa dependensi)
  test-rules-isolation.mjs   # Uji isolasi rules A vs B (lihat bagian 6)
functions/                   # Cloud Functions (Fase 2): joinWedding + deadline reminder
firestore.rules, storage.rules, firebase.json
```

## 5. Skema Data

Sesuai PRD Section 8 + **Fase 2 (kolaborasi pasangan)**:

```
weddings/{weddingId}                 ← data pernikahan BERSAMA 2 akun
  - weddingDate, venue, totalBudget*   (*FR-12; venue/date kosong = belum onboard)
  - members: [uidA, uidB]              (maks 2; id dokumen = uid pembuat)
  - coupleNames: { uid → nama }        (label "A & B" di dashboard)
  - inviteCode, createdBy, createdAt

weddings/{weddingId}/checklist/{itemId}
  - title, category, dueDate, isCompleted, createdAt

weddings/{weddingId}/budget/{categoryId}
  - categoryName, allocatedAmount, expenses: [{ description, amount, date, receiptUrl }]

weddings/{weddingId}/vendors/{vendorId}
  - name, category, contact, status, dealAmount, paymentDeadline, notes, createdAt

weddingInvites/{code}                 ← lookup join (id = kode 6 huruf/angka, sekali pakai)
  - weddingId, createdAt

users/{userId}                        ← identitas akun + penunjuk data bersama (Fase 2)
  - email, displayName, partnerName, createdAt
  - weddingId*                        (*Fase 2: rujukan ke weddings/{id})
  - weddingDate/venue/totalBudget      (LEGACY — dipindah ke weddings saat migrasi)

users/{userId}/devices/{token}        ← token FCM per device (reminder deadline)
  - token, platform, createdAt

users/{userId}/checklist|budget|vendors   ← jalur LEGACY (backup; dipakai migrasi satu arah)
```

**Catatan implementasi:**

- **Migrasi otomatis (lazy, idempotent):** saat login pertama setelah update, akun lama dipindah dari `users/{uid}` ke `weddings/{uid}` (id deterministik = uid → aman dipanggil berulang). Subcollection lama disalin **hanya jika target kosong**; struct lama di Storage **tidak dipindah** agar URL tersimpan tetap valid (rules mengizinkan partner baca). Field di `users/{uid}` dipertahankan sebagai backup/label legacy.
- **`totalBudget` (FR-12)** — nilai tidak dispesifikasi PRD; sejak Fase 2 disimpan di `weddings/{weddingId}/totalBudget` agar selalu sinkron untuk kedua akun.
- `categoryId` = **slug determinik** dari nama kategori (mis. `Legal/Dokumen` → `legal-dokumen`) sehingga alokasi selalu upsert, tidak pernah menggandakan dokumen.
- Item `expenses` diedit berbasis **index** dalam array (skema persis PRD, tanpa id per-transaksi). Karena array di-*merge* keseluruhan, pengeditan bersamaan kedua partner bersifat *last-write-wins* per kategori (dibatasi kolaborasi 2 orang — risiko diterima, dikomentari di kode).
- **Storage:** struct setelah Fase 2 → `weddings/{weddingId}/receipts/{timestamp}-{nama}`; yang lama tetap di `users/{uid}/receipts`. Maks **5 MB** (divalidasi di aplikasi *dan* rules).
- **Kode undangan:** 6 karakter dari alfabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (tanpa huruf mudah tertukar: O/0/I/1); keunikan dijamin oleh dokumen id `weddingInvites/{code}`; dipakai sekali lalu dihapus oleh `joinWedding`. `/^[A-Z2-9]{6}$/` di validasi fungsi.

## 6. Keamanan (Security Rules) & Uji Isolasi

**Prinsip: membership-based, default deny.** `firestore.rules` membuka data pernikahan (`weddings/{id}/**`) hanya untuk **member** (`request.auth.uid in get(...).data.members`); `users/{uid}` & `users/{uid}/devices` tetap owner-only; `weddingInvites` hanya bisa dibuat anggota wedding terkait. Update wedding wajib mempertahankan `members` dan `createdBy` (tak bisa tukar/lempar akun). Join anggota dilakukan **Callable Function `joinWedding`** (admin SDK) karena rules klien sengaja melarang user menambah diri ke members milik orang lain.

`storage.rules` memisahkan `read` / `write` (maks 5 MB) / `delete`; `weddings/{id}/**` member-only; `users/{uid}/receipts` lama boleh dibaca/dihapus **owner maupun partner** (member dari `weddings/{uid}` — id wedding = uid pembuat).

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
npx firebase-tools emulators:exec --only auth,firestore,storage,functions \
  --project demo-wedplan "node scripts/test-rules-isolation.mjs --emulator"
```

**Jalur B — proyek asli (setelah rules di-deploy):**

```bash
# isi .env.local dulu, lalu:
node scripts/test-rules-isolation.mjs
```

Skrip menguji 10+ skenario: A akses data sendiri (wajib lolos), akses tanpa login, B membaca/menulis/menghapus data A (user B bukan member → `DENY`), B mengunggah struk ke folder A, dan skenario kolaborasi: A membuat `weddings/{A}` dengan members `[A, B]` → **B boleh** baca/tulis (member); **C yang bukan member `DENY`**; create `weddings/{C}` oleh pihak lain → `DENY`. Keluaran `PASS/FAIL` per skenario, exit code ≠ 0 bila gagal. Jalur B membuat 2 akun uji `rules-test-*@example.com` (dokumen dibersihkan otomatis; akun bisa dihapus via Console → Authentication).

**Jalur manual (tanpa alat):** Firebase Console → Firestore → **Rules → Testing tab** → simulasi `uid: userA` pada dokumen `weddings/userB/...` → hasil wajib **DENY**; atau dua browser (normal + incognito) dengan dua akun berbeda.

## 7. Deploy ke Vercel

1. Push repo ini ke GitHub/GitLab.
2. [vercel.com/new](https://vercel.com/new) → import repo → preset **Next.js** terdeteksi otomatis (build: `next build`).
3. Isi **Environment Variables** (Production *dan* Preview):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_VAPID_KEY` *(Fase 2, wajib untuk reminder)* — dari Firebase Console → Cloud Messaging → Web Push certificates
   - `NEXT_PUBLIC_APP_URL=https://<domain-kamu>` (untuk URL absolut manifest/PWA).
4. **Deploy** → dapatkan domain (mis. `wedplan.vercel.app` atau domain sendiri).
5. Firebase Console → Authentication → **Settings → Authorized domains** → tambahkan domain Vercel (wajib untuk login Google).
6. Deploy rules ke Firebase (bagian [6](#6-keamanan-security-rules--uji-isolasi)) **sebelum** user pertama mendaftar.
7. Deploy Cloud Functions (bagian [7b](#deploy-cloud-functions-fase-2)) — wajib agar **gabung via kode undangan** & **reminder deadline** berfungsi.
8. Uji live: daftar → onboarding → isi 3 modul → install PWA (bagian 10).

## 7b. Deploy Cloud Functions (Fase 2)

```bash
cd functions
npm install
npm run build        # = tsc → lib/index.js (juga jalan otomatis saat deploy)
cd ..
firebase deploy --only functions
```

Setelah deploy, catat nama fungsi (`joinWedding`, `scheduledDeadlineReminder`) dan region-nya — panggilan dari client memakai region default `us-central1` (bila mengganti region, set `NEXT_PUBLIC_APP_URL` tidak perlu, tetapi pastikan `getFirebaseFunctions()` memakai `region` yang sama).

**Persyaratan jadwal (onSchedule):** Cloud Functions **Scheduled** butuh **Blaze (bayar-per-pakai)** plan — `scheduledDeadlineReminder` tidak akan berjalan di Spark. Tanpa Blaze, kolaborasi (`joinWedding`) tetap berfungsi (callable tidak terjadwal).

## 8. PWA (Manifest, Service Worker, Offline)

| File | Peran |
|---|---|
| `app/manifest.ts` | Manifest: `name/short_name`, `start_url: /dashboard`, `display: standalone`, `theme_color: #e11d48`, ikon 192 + 512 + maskable |
| `public/icons/*` | Ikon hasil `npm run icons` (hati rose, prosedural) + `apple-touch-icon` 180px (ada juga salinan di root `/apple-touch-icon.png` untuk fallback iOS) |
| `app/sw.js/route.ts` | **Route handler** yang menyajikan `/sw.js` (config Firebase di-inject saat request — file statis `public/` tidak bisa baca env). Isi: **navigasi network-first → cache → `/offline`**; `/_next/static/*` cache-first; lainnya stale-while-revalidate; cross-origin (Firebase) tidak di-cache; precache 10 route + manifest; `VERSION = "v2"`. Tambahan Fase 2: `importScripts` FCM compat `12.19.0` + `onBackgroundMessage` + `notificationclick` → ke `/checklist` `/vendors` `/dashboard` |
| `components/providers/sw-register.tsx` | Registrasi SW **hanya di production** (dev sengaja tanpa SW agar tidak kena cache stale) |
| `next.config.ts` | Header `/sw.js`: `Cache-Control: no-cache` + `Service-Worker-Allowed: /` |

**Perilaku offline:** halaman yang pernah dibuka → tampil dari cache; halaman belum pernah dibuka → halaman `/offline` yang informatif; data Firebase tetap butuh koneksi.

**Meng-update SW:** ubah nilai `VERSION` di `app/sw.js/route.ts` lalu deploy — browser otomatis buang cache lama saat `activate`.

**Notifikasi di background:** hanya berfungsi setelah registrasi SW (production) & device mendaftar token (Pengaturan → Pengingat). Token disimpan di `users/{uid}/devices/{token}` dan dipakai Cloud Function terjadwal.

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
- [ ] **Rules isolation PASS** (jalur A/B/manual di [bagian 6](#6-keamanan-security-rules--uji-isolasi)) — termasuk skenario member vs non-member wedding.
- [ ] **Kolaborasi (Fase 2)**: 2 akun; A buat data → bagikan kode → B join (kode sekali pakai) → keduanya lihat data sama & label "A & B"; B lewat kode saat slot penuh → ditolak; non-member → `permission-denied`.
- [ ] **Migrasi akun lama**: akun yang sudah punya data `users/{uid}` → login → otomatis pindah ke `weddings/{uid}` tanpa duplikasi (checklist/budget/vendor & totalBudget ikut; struk lama tetap bisa dibuka partner).
- [ ] **Reminder (Fase 2)**: aktifkan notifikasi di Pengaturan (perlu VAPID + Functions ter-deploy + Blaze) → set dueDate H-7/H-3/H-1 → terima push di latar belakang; klik notifikasi → buka halaman terkait; nonaktifkan → tidak ada push.
- [ ] **Live** di domain Vercel dengan Firebase aktif (URL dicatat di sini setelah deploy).

## 11. Future Enhancement (di luar cakupan saat ini)

Sesuai PRD (Out-of-Scope + Roadmap) — **belum dan tidak diimplementasikan**:

1. **Integrasi** ke produk wedding invitation Nexus Diji (satu akun untuk keduanya / cross-sell).
2. **Vendor marketplace / direktori** vendor pihak ketiga.
3. Mode **wedding organizer** (multi-client, role planner).
4. **Payment gateway** / transaksi di dalam aplikasi.

**Catatan keputusan implementasi:**

- Kolaborasi hanya **2 akun** per data (`members` maks 2; rules & `joinWedding` menegakkan) — bila butuh multi-role planner kelak, jadikan `members` fleksibel.
- **Push reminder** memakai `scheduledDeadlineReminder` (onSchedule 02:00 Asia/Jakarta) + dedup `notifications/{key}`; untuk pemicu lebih realtime bisa beralih ke `onSchedule` per-frekuesi atau trigger Firestore saat deadline berubah.
- Service worker disajikan via **route handler** (`app/sw.js/route.ts`) agar config FCM di-inject dari env; ganti ke `next-pwa` tidak kompatibel dengan toolchain Next 16.
- Proteksi rute via **layout guard** (`AuthGuard`/`GuestGuard`) alih-alih `proxy.ts` — sesi Firebase hidup di IndexedDB client dan tidak bisa diverifikasi dari runtime server/edge.
- Chart memakai **bar** (PRD mengizinkan "donut/bar") — bar horizontal agar label kategori terbaca di layar sempit.
- `expenses` diedit berbasis index (skema tanpa id per-transaksi, *last-write-wins* antar partner per kategori) → bila kelak butuh audit trail, tambahkan `id` per item sebagai field baru (tanpa migrasi).
- Akun legacy di-*backup*: subcollection & field lama di `users/{uid}` tidak dihapus pasca-migrasi (mudah rollback).
- Ikon PWA digenerate **prosedural** (hati rose) — ganti dengan aset desain bila tersedia (`npm run icons` setelah mengubah generator).
