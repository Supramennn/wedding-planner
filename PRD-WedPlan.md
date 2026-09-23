# PRD: WedPlan — Wedding Planner PWA

**Produk oleh:** Nexus Diji
**Versi:** 1.0 (MVP)
**Tanggal:** 23 September 2026
**Status:** Draft — siap eksekusi

---

## 1. Latar Belakang & Tujuan

Calon pengantin di Indonesia umumnya mengelola persiapan pernikahan secara manual: spreadsheet, chat WhatsApp berserakan, catatan fisik. Tidak ada satu tempat terpusat untuk memantau checklist, budget, dan progress vendor.

**WedPlan** adalah aplikasi web progresif (PWA) yang bisa di-install seperti aplikasi native di Android & iOS, memungkinkan calon pengantin mengelola seluruh persiapan pernikahan mereka secara mandiri dari satu dashboard.

**Tujuan bisnis:**
- Menjadi lini produk baru Nexus Diji, melengkapi produk wedding invitation yang sudah ada
- Membuka peluang cross-sell: user WedPlan diarahkan ke produk undangan digital Nexus Diji, dan sebaliknya
- Validasi cepat sebagai MVP sebelum ekspansi ke fitur kolaboratif/vendor marketplace di fase berikutnya

---

## 2. Target Pengguna

**Primary persona:** Calon pengantin (1 atau 2 akun pasangan) yang merencanakan pernikahan mereka sendiri — bukan wedding organizer/vendor yang mengelola banyak klien.

**Karakteristik:**
- Awam teknologi hingga menengah — UI harus sederhana dan tidak membingungkan
- Dominan mengakses dari smartphone
- Butuh kejelasan visual (progress, sisa waktu, sisa budget) tanpa harus menghitung manual

---

## 3. Problem Statement

| Masalah saat ini | Dampak |
|---|---|
| Checklist tersebar di banyak media (notes, chat, kepala) | Ada item yang terlewat/lupa |
| Budget tidak terpantau real-time | Overspending tanpa disadari sampai mendekati hari-H |
| Status vendor & deadline pembayaran tidak terpusat | Risiko telat DP/lunas, komunikasi miss |
| Tidak ada gambaran progress keseluruhan | Stres karena tidak tahu "sudah sejauh mana" persiapan |

---

## 4. Scope MVP (In-Scope)

1. Autentikasi (Email/Password + Google Sign-In)
2. Onboarding wizard (data dasar pernikahan)
3. Dashboard ringkasan (countdown, progress, budget, vendor)
4. Modul Checklist Persiapan
5. Modul Budget Tracker
6. Modul Timeline Vendor
7. PWA installable di Android & iOS (manifest, service worker, offline fallback)
8. Deploy production di Vercel dengan Firebase sebagai backend

### Out-of-Scope (Fase 2+, tidak dikerjakan di MVP ini)
- Kolaborasi realtime 2 akun pasangan dalam 1 data pernikahan
- Push notification reminder (Firebase Cloud Messaging)
- Integrasi langsung ke produk wedding invitation Nexus Diji
- Vendor marketplace / direktori vendor pihak ketiga
- Fitur multi-user untuk wedding organizer (role planner)
- Payment gateway / transaksi di dalam app

---

## 5. User Stories & Functional Requirements

### 5.1 Autentikasi & Onboarding
- **US-01**: Sebagai calon pengantin, saya bisa daftar akun via email atau Google agar data saya tersimpan aman dan personal.
- **US-02**: Sebagai user baru, saya diarahkan ke onboarding wizard untuk mengisi nama pasangan, tanggal pernikahan (target), dan lokasi acara (opsional), agar aplikasi bisa langsung generate checklist relevan.

**Functional requirements:**
- FR-01: Sistem memvalidasi format email & password minimal (8 karakter)
- FR-02: Setelah onboarding selesai, sistem auto-generate checklist default berdasarkan kategori standar
- FR-03: Data onboarding tersimpan di `users/{userId}` dan bisa diedit ulang dari halaman profil/pengaturan

### 5.2 Dashboard
- **US-03**: Sebagai user, saya ingin melihat ringkasan progress (checklist, budget, vendor) begitu buka aplikasi, agar saya langsung tahu kondisi persiapan saya.

**Functional requirements:**
- FR-04: Dashboard menampilkan countdown ke hari-H (dalam hari)
- FR-05: Dashboard menampilkan % checklist selesai (keseluruhan)
- FR-06: Dashboard menampilkan total budget terpakai vs total alokasi (dengan indikator warna)
- FR-07: Dashboard menampilkan jumlah vendor per status (dihubungi/nego/deal/lunas)

### 5.3 Checklist Persiapan
- **US-04**: Sebagai user, saya ingin checklist tugas persiapan yang sudah terkategorisasi otomatis, agar saya tidak perlu mulai dari nol.
- **US-05**: Sebagai user, saya ingin menambah, mengedit, menghapus, dan menandai selesai item checklist sesuai kebutuhan saya.

**Functional requirements:**
- FR-08: Kategori default: Legal/Dokumen, Venue, Catering, Dekorasi, Busana, Dokumentasi, Undangan, Hiburan, Lain-lain
- FR-09: Setiap item punya: judul, kategori, due date (opsional), status selesai/belum
- FR-10: Progress bar ditampilkan per kategori dan total keseluruhan
- FR-11: Perubahan tersimpan realtime ke Firestore (tidak perlu tombol "save" terpisah)

### 5.4 Budget Tracker
- **US-06**: Sebagai user, saya ingin menetapkan total budget dan alokasi per kategori, agar pengeluaran saya terarah.
- **US-07**: Sebagai user, saya ingin mencatat pengeluaran aktual dan melihat sisa budget per kategori, agar saya tidak overspending.

**Functional requirements:**
- FR-12: User set total budget pernikahan di awal (bisa diedit kapan saja)
- FR-13: Alokasi budget per kategori — bisa input nominal langsung atau persentase dari total
- FR-14: Setiap pengeluaran dicatat dengan: deskripsi, nominal, tanggal, kategori, foto struk (opsional, upload ke Firebase Storage)
- FR-15: Visualisasi chart (donut/bar, pakai Recharts) menunjukkan alokasi vs realisasi per kategori
- FR-16: Indikator warna: hijau (<70% terpakai), kuning (70–99%), merah (≥100%, over budget)

### 5.5 Timeline Vendor
- **US-08**: Sebagai user, saya ingin mencatat semua vendor yang saya hubungi beserta statusnya, agar saya tidak kehilangan jejak negosiasi.
- **US-09**: Sebagai user, saya ingin diingatkan secara visual kalau deadline pembayaran vendor mendekati.

**Functional requirements:**
- FR-17: Setiap vendor punya: nama, kategori, kontak (telp/WA/email), status (dihubungi → nego → deal → DP → lunas), nominal deal, deadline pembayaran, catatan
- FR-18: Dua mode tampilan: list (sortable) dan timeline/kalender (urut berdasarkan deadline)
- FR-19: Highlight visual (warna/badge) untuk deadline yang jatuh dalam H-7, H-3, H-1

### 5.6 PWA Requirements
- **US-10**: Sebagai user, saya ingin bisa install aplikasi ini di HP saya seperti aplikasi biasa, agar mudah diakses tanpa buka browser dan ketik URL.

**Functional requirements:**
- FR-20: Manifest lengkap (nama, short_name, theme_color, background_color, display: standalone, icons 192px/512px + maskable)
- FR-21: Service worker untuk caching aset statis + halaman offline fallback yang informatif
- FR-22: Lulus semua checklist PWA installability di Lighthouse audit
- FR-23: Responsive mobile-first, tervalidasi di Chrome Android & Safari iOS

---

## 6. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| Performance | First load < 3 detik di koneksi 4G rata-rata |
| Security | Firestore Security Rules ketat — user hanya bisa akses data miliknya sendiri (`users/{ownUserId}`) |
| Accessibility | `MotionConfig reducedMotion="user"` untuk semua animasi Framer Motion |
| Compatibility | Chrome, Safari (iOS), Edge — versi 2 tahun terakhir |
| Scalability | Struktur Firestore harus siap ditambah field/koleksi baru di fase 2 tanpa migrasi besar |
| Maintainability | Kode modular, komponen reusable, dokumentasi README untuk handover/maintenance |

---

## 7. Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Chart**: Recharts
- **PWA**: next-pwa / native service worker config
- **Hosting**: Vercel
- **Dev constraint**: `next dev --webpack` (bukan Turbopack — bug CSS cache)

---

## 8. Skema Data (Firestore)

```
users/{userId}
  - email, displayName, partnerName, weddingDate, venue, createdAt

users/{userId}/checklist/{itemId}
  - title, category, dueDate, isCompleted, createdAt

users/{userId}/budget/{categoryId}
  - categoryName, allocatedAmount, expenses: [{ description, amount, date, receiptUrl }]

users/{userId}/vendors/{vendorId}
  - name, category, contact, status, dealAmount, paymentDeadline, notes, createdAt
```

---

## 9. Milestone & Timeline Estimasi

| Fase | Deliverable | Estimasi |
|---|---|---|
| 1 | Setup project + Firebase + Auth | 1–2 hari |
| 2 | Onboarding + Dashboard | 1 hari |
| 3 | Modul Checklist | 1 hari |
| 4 | Modul Budget Tracker | 1–1.5 hari |
| 5 | Modul Timeline Vendor | 1–1.5 hari |
| 6 | PWA setup + Lighthouse audit | 1 hari |
| 7 | Testing lintas device + Deploy production | 0.5–1 hari |

**Total estimasi: ±7 hari kerja** untuk MVP live production.

---

## 10. Success Metrics (MVP)

- Aplikasi lulus Lighthouse PWA audit (installable, score installability 100%)
- Ketiga modul inti (Checklist, Budget, Vendor) berfungsi penuh tanpa bug kritis
- Berhasil di-install & digunakan mulus di minimal 1 device Android dan 1 device iOS
- Live di domain production Vercel dengan Firebase backend aktif

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Instalasi PWA di iOS punya batasan (tidak sepenuhnya sama seperti Android) | Test manual di Safari iOS sejak awal, jangan asumsikan parity penuh dengan Android |
| Firestore free tier limit terlampaui saat testing intensif | Monitor usage di Firebase Console, set budget alert |
| Scope creep ke fitur fase 2 saat development | PRD ini jadi acuan tegas — fitur di luar scope MVP ditolak/dicatat untuk fase 2 |

---

## 12. Roadmap Fase 2 (Referensi, bukan bagian MVP ini)

- Kolaborasi 2 akun pasangan dalam 1 data pernikahan
- Push notification reminder (FCM)
- Integrasi ke produk wedding invitation Nexus Diji (satu akun untuk keduanya)
- Direktori/marketplace vendor
