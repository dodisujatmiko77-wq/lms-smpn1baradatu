# Tahap 7 — Monitoring & Laporan: Panduan Pemasangan, Pemakaian & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Peran | Menu | Isi |
|---|---|---|
| **Admin** | Dashboard | Grafik **aktivitas pembelajaran** guru & siswa (7/30/90 hari). |
| | **Monitoring Pembelajaran** | Setiap kelas-mapel: jumlah materi · tugas · kuis, rata-rata penyelesaian materi, siswa aktif 7 hari, dan aktivitas guru terakhir. Bisa difilter: *belum ada materi*, *guru tidak aktif 14 hari*, *penyelesaian < 50%*. |
| | **Monitoring Tugas** | Setiap tugas: % pengumpulan, terlambat, belum mengumpulkan, belum dinilai, dan rata-rata nilai. Klik tugas untuk melihat **nama siswa yang belum mengumpulkan**. |
| | **Laporan** | Tab **Aktivitas** (grafik + keaktifan guru), **Rekap kelas** (tabel siswa × mapel: nilai atau progress materi), dan **Rekap per mapel** (setiap tugas/kuis sebagai kolom). |
| **Guru** | **Laporan Pembelajaran** | Rekap nilai per kelas-mapel (tugas & kuis sebagai kolom, rata-rata, jumlah belum mengumpulkan) dan grafik keaktifan kelas. |
| **Wali kelas** | **Kelas Binaan** | Ringkasan kelas: jumlah siswa, rata-rata nilai, penyelesaian materi, jumlah siswa yang perlu tindak lanjut. Ada juga rekap siswa × semua mapel dan grafik keaktifan kelas. |
| | **Monitoring Tugas** | Semua tugas dari seluruh mapel di kelas binaan, beserta siswa yang belum mengumpulkan. |
| | **Perlu Tindak Lanjut** | Daftar otomatis siswa yang memerlukan perhatian, dengan **alasan yang jelas** dan diurutkan dari prioritas tertinggi. |
| **Semua (kecuali siswa)** | **Laporan Siswa** | Klik nama siswa di rekap mana pun untuk melihat nilai per mapel, daftar tugas & statusnya, kuis, badge, aktivitas terakhir, dan nomor orang tua (hanya untuk wali kelas/admin). |

**Unduh Excel / PDF** tersedia di setiap tabel laporan. Berkas memuat nama sekolah, judul, keterangan, dan tanggal cetak.

### Aturan perhitungan

- Nilai memakai skala **0–100**:
  - Tugas dihitung sebagai `nilai ÷ nilai maksimum × 100`.
  - Untuk kuis dipakai **nilai terbaik**.
  - **Rata-rata** adalah rata-rata semua tugas dan kuis yang sudah dinilai di mapel tersebut.
- Laporan kelas dan laporan siswa hanya memakai **nilai tugas yang sudah diterbitkan** dan **kuis yang sudah selesai dinilai**. Rekap guru juga menampilkan nilai yang belum terbit, dengan warna abu-abu.
- **KKM** diatur admin di **Pengaturan Sekolah** (bawaan 75). Nilai di bawah KKM ditampilkan merah.
- **Perlu tindak lanjut** bila siswa memenuhi salah satu kondisi berikut:
  - ada tugas lewat tenggat yang belum dikumpulkan;
  - ada mapel dengan rata-rata di bawah KKM;
  - ada kuis yang tidak dikerjakan;
  - penyelesaian materi di bawah 50%;
  - tidak aktif lebih dari 7 hari.

  Tingkatnya: *Pantau* → *Perlu perhatian* → *Prioritas*.
- **Aktivitas** dicatat otomatis oleh database:
  - Siswa: membuka/menyelesaikan materi, mengumpulkan tugas, mengerjakan kuis, menulis di forum.
  - Guru: menerbitkan materi/tugas/kuis, menilai, membuat pengumuman, menulis di forum.
  - Data lama (sebelum migrasi ini) ikut dimasukkan sekali saat migrasi. Log yang lebih tua dari ±13 bulan dibersihkan otomatis.

### Hak akses (ditegakkan di server)

| Data | Admin | Wali kelas | Guru mapel | Siswa |
|---|---|---|---|---|
| Rekap kelas / laporan siswa | Semua kelas | Kelas binaan, **semua mapel** | Kelas yang diajar, **hanya mapelnya** | Tidak |
| Monitoring tugas & pembelajaran | Semua | Kelas binaan | Kelasnya | Tidak |
| Perlu tindak lanjut | Semua kelas | Kelas binaan | Tidak | Tidak |
| Grafik sekolah & keaktifan guru | Ya | Grafik kelas binaan | Grafik kelasnya | Tidak |
| Nomor HP orang tua | Ya | Ya | Tidak | Tidak |
| Log aktivitas mentah | Tidak dapat dibaca langsung oleh siapa pun; hanya ringkasannya lewat laporan | | | |

---

## 2. Pemasangan di Supabase

1. **SQL Editor** → jalankan `supabase/migrations/0011_reports.sql`.
2. Edge Function dan Storage **tidak berubah**.
3. Aplikasi: `git pull` → **`npm install`** (ada library baru untuk PDF: jsPDF 4.2.1 versi aman + autoTable) → `npm run dev`.
4. Opsional: atur **KKM** di **Pengaturan Sekolah**.

---

## 3. Checklist pengujian manual

### Admin
- [ ] Dashboard menampilkan grafik aktivitas. Ganti 7/30/90 hari.
- [ ] **Monitoring Pembelajaran** → filter "Belum ada materi terbit" → kelas-mapel yang kosong muncul. **Unduh → Excel**.
- [ ] **Monitoring Tugas** → klik tugas yang lewat tenggat → muncul nama siswa yang belum mengumpulkan.
- [ ] **Laporan → Rekap kelas** → pilih kelas → ganti tab Nilai/Progress materi → **Unduh → PDF**.
- [ ] **Pengaturan Sekolah** → ubah KKM → angka merah di laporan ikut berubah.

### Guru
- [ ] **Laporan Pembelajaran** → pilih kelas-mapel → rekap nilai tampil → Unduh Excel.
- [ ] Klik nama siswa → Laporan Siswa hanya menampilkan mapel Anda.

### Wali kelas
- [ ] **Kelas Binaan** → angka ringkasan sesuai, rekap semua mapel tampil.
- [ ] **Perlu Tindak Lanjut** → siswa yang jarang aktif/tidak mengumpulkan muncul beserta alasannya → Unduh PDF untuk rapat dengan orang tua.
- [ ] Laporan Siswa menampilkan nomor orang tua.

---

## 4. Pengujian otomatis

| Uji | Hasil |
|---|---|
| RLS & aturan data (SQL), Tahap 1–7 | **357/357 lolos** (51 baru) |
| Ujung-ke-ujung Tahap 1–6 (regresi) | **36 / 28 / 24 / 27 / 28 / 31 lolos** |
| Ujung-ke-ujung Tahap 7 | **21/21 lolos** |
| Alur browser: admin (dashboard, monitoring, laporan, unduh Excel & PDF) → guru (laporan, unduh) → wali kelas (kelas binaan, tindak lanjut, laporan siswa, tampilan HP) | **13/13 lolos**, tanpa error konsol/HTTP; berkas Excel & PDF berhasil dibuat dan isinya benar |
