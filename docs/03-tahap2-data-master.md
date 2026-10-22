# Tahap 2 — Data Master: Panduan Pemasangan, Pemakaian & Pengujian

## 1. Yang dikerjakan pada tahap ini

| Modul | Fitur |
|---|---|
| Tahun Pelajaran & Semester | Buat TP (semester Ganjil & Genap otomatis), ubah tanggal, **aktifkan semester** (hanya satu yang aktif), hapus TP kosong |
| Mata Pelajaran | CRUD, warna penanda, kelompok (Umum/Pilihan/Muatan Lokal), sembunyikan; tombol **"Tambahkan mapel standar"** (12 mapel SMP Kurikulum Merdeka + Bahasa Lampung) |
| Kelas | Per tahun pelajaran & tingkat; **buat beberapa kelas sekaligus** (VII-A s.d. VII-F); kapasitas & ruang |
| Detail Kelas | Tab **Siswa** (tambah/keluarkan), **Mapel & Guru**, **Jadwal**; pilih wali kelas langsung; beralih Ganjil/Genap |
| Data Guru | CRUD, NIP/NUPTK, status kepegawaian, beban mengajar, wali kelas; reset password & aktif/nonaktif; **impor Excel** |
| Data Siswa | CRUD, NISN/NIS, data orang tua, status (aktif/lulus/pindah/keluar); filter kelas & "belum punya kelas"; **pilih banyak → tempatkan ke kelas**; **impor Excel** (sekaligus menempatkan kelas) |
| Penugasan Mengajar | Guru × kelas × mapel per semester; satu guru ke beberapa kelas sekaligus; filter; **salin Ganjil → Genap** |
| Wali Kelas | Satu kelas satu wali per semester; guru yang ditetapkan otomatis mendapat menu **Wali Kelas** |
| Jadwal Pelajaran | Jadwal mingguan per kelas & per guru; **bentrok otomatis ditolak** (kelas sama atau guru sama di jam beririsan) |
| Guru | Dashboard: kelas diajar, jumlah siswa, jadwal hari ini; menu **Jadwal Mengajar** |
| Siswa | Beranda: kelasnya, jadwal hari ini, mapel & guru; menu **Jadwal** |
| Admin | Dashboard: siswa aktif, guru, kelas, mapel + **checklist kesiapan** 10 langkah |

### Keputusan teknis (mohon dicatat)

1. **Semester aktif** disimpan sebagai penanda `is_active` di tabel `semesters` (satu sumber kebenaran). Kolom `active_semester_id` di `school_settings` dari rancangan awal tidak dipakai, agar tidak ada dua data yang bisa saling bertentangan.
2. **Jadwal memakai jam mulai–selesai**, bukan tabel "jam ke-". Ini lebih fleksibel untuk hari Jumat/Sabtu yang lebih pendek.
3. **Edge Function `admin-users` diperluas**: aksi `create` kini bisa sekaligus menyimpan data guru/siswa dan menempatkan kelas, dan ada aksi baru `bulk_create` untuk impor (maksimal 50 baris per permintaan; aplikasi mengirim 25 baris per kelompok). Bila satu langkah gagal (misalnya NISN ganda), akun yang sudah terbuat **dihapus kembali**, sehingga tidak ada akun "setengah jadi".
4. **Data pribadi**:
   - Guru hanya melihat data siswa di kelas yang ia ajar atau walikan (tahun pelajaran aktif).
   - Siswa hanya melihat datanya sendiri. Nama guru di jadwal diambil lewat fungsi server, jadi NIP guru tidak terbuka.
   - NIP/NUPTK guru hanya terlihat oleh admin dan guru yang bersangkutan.

---

## 2. Pemasangan di Supabase (urutan penting)

### 2.1 Jalankan 2 migrasi baru

**SQL Editor → New query**, lalu jalankan **berurutan**:

1. `supabase/migrations/0003_academic_master.sql`
2. `supabase/migrations/0004_master_rls_rpc.sql`

File 0001 dan 0002 **tidak perlu** dijalankan ulang.

### 2.2 Perbarui Edge Function `admin-users` (WAJIB, sebelum memakai menu baru)

1. **Edge Functions → admin-users → Code**
2. Hapus semua isi editor, lalu tempel isi `supabase/functions/admin-users/index.ts` yang baru.
3. Klik **Deploy**.

Bila function belum diperbarui, aplikasi akan menampilkan peringatan *"data siswa TIDAK tersimpan karena Edge Function admin-users belum diperbarui"*. Jika peringatan itu muncul, perbarui function, lalu nonaktifkan akun yang terlanjur dibuat.

### 2.3 Perbarui kode aplikasi

```bash
git pull               # atau unduh ZIP terbaru dari GitHub
npm install            # WAJIB: ada library baru (exceljs)
npm run dev
```

> **Gejala bila `npm install` terlewat:** menu **Data Guru** dan **Data Siswa** menampilkan *"Failed to fetch dynamically imported module"* atau *"Halaman gagal dimuat"*, sementara menu lain normal. Terminal menampilkan *"Failed to resolve import "exceljs""*.
> **Solusi:** hentikan server (Ctrl+C) → `npm install` → `npm run dev` → tekan Ctrl+Shift+R di browser.

---

## 3. Urutan menyiapkan data sekolah (sekali di awal tahun pelajaran)

Ikuti checklist **Kesiapan sistem** di dashboard admin:

1. **Tahun Pelajaran** → Tambah `2026/2027` → **Aktifkan** semester Ganjil.
2. **Mata Pelajaran** → *Tambahkan mapel standar* → sesuaikan bila perlu.
3. **Kelas** → *Buat sekaligus*: VII (misalnya 9 rombel), VIII, IX.
4. **Data Guru** → *Impor Excel* (unduh template → isi → unggah) → **Unduh daftar akun**.
5. **Data Siswa** → *Impor Excel*. Isi kolom **Kelas** agar siswa langsung ditempatkan → **Unduh daftar akun**.
6. **Wali Kelas** → pilih guru untuk setiap kelas.
7. **Penugasan Mengajar** → pilih guru + mapel + beberapa kelas sekaligus.
8. **Jadwal Pelajaran** → per kelas, klik **Tambah** pada hari yang diinginkan.
9. Bagikan daftar akun kepada guru dan wali kelas. Wali kelas membagikannya ke siswa. Semua wajib ganti password saat login pertama.

> **Semester Genap:** aktifkan semester Genap, lalu buka **Penugasan Mengajar → Salin dari Ganjil**. Wali kelas dan jadwal diatur ulang untuk semester Genap.

### Tips impor Excel

- Selalu gunakan **template dari aplikasi**. Semua kolomnya sudah berformat *Teks*, sehingga angka 0 di depan NISN/NIP tidak hilang.
- Kolom **L/P** menerima `L`, `P`, `Laki-laki`, atau `Perempuan`.
- Kolom **Kelas** menerima `VII-A`, `7A`, `VII A`, atau `vii-a`.
- **Tanggal lahir**: `2013-05-21` atau `21/05/2013`.
- Baris bermasalah ditampilkan merah di pratinjau dan **dilewati**. Baris lain tetap diimpor.
- **Daftar akun** (username + password sementara) hanya bisa diunduh sesaat setelah impor. Simpan dengan aman.

---

## 4. Checklist pengujian manual

### Admin
- [ ] Buat TP baru → otomatis ada semester Ganjil & Genap. Aktifkan Ganjil → header menampilkan `TP 2026/2027 · Ganjil`.
- [ ] Tambahkan mapel standar → 12 mapel muncul. Ubah warna salah satu mapel.
- [ ] Buat 3 kelas sekaligus. Membuat kelas dengan nama yang sama di TP yang sama ditolak.
- [ ] Impor 5–10 siswa dari template (sengaja isi 1 baris NISN salah) → pratinjau menandai baris salah → impor → unduh daftar akun.
- [ ] Data Siswa: filter **Belum punya kelas** → pilih beberapa → **Tempatkan ke kelas**.
- [ ] Ubah data siswa & pindahkan kelasnya.
- [ ] Tambah guru lewat form (dengan NIP) dan lewat impor Excel.
- [ ] Penugasan: 1 guru → 1 mapel → 2 kelas sekaligus. Membuat penugasan ganda untuk mapel yang sama di kelas yang sama ditolak/dilewati.
- [ ] Wali Kelas: tetapkan wali untuk setiap kelas.
- [ ] Jadwal: tambah jadwal Senin 07:30–08:50. Tambah lagi di jam yang beririsan → muncul pesan **"Jadwal bentrok …"**.
- [ ] Jadwal → tab **Per guru** menampilkan jadwal guru tersebut lintas kelas.
- [ ] Menghapus kelas yang masih berisi siswa ditolak dengan pesan jelas.
- [ ] Audit Log mencatat impor massal, penugasan, wali kelas, penempatan siswa.

### Guru (login dengan NIP dari daftar akun)
- [ ] Wajib ganti password → dashboard menampilkan kelas yang diajar & jumlah siswa.
- [ ] Bila ditetapkan sebagai wali kelas: badge **Wali kelas VII-A** dan grup menu **Wali Kelas** muncul.
- [ ] **Jadwal Mengajar** menampilkan seluruh jadwal minggu ini; hari ini disorot.
- [ ] Membuka `/admin/kelas` → **Akses ditolak**.

### Siswa (login dengan NISN)
- [ ] Beranda menampilkan kelas, jadwal hari ini, dan daftar mapel beserta gurunya.
- [ ] **Jadwal** hanya berisi jadwal kelasnya.
- [ ] Membuka `/admin/siswa` → **Akses ditolak**.

---

## 5. Pengujian otomatis

| Uji | Lokasi | Hasil |
|---|---|---|
| RLS & aturan data (SQL) | `supabase/tests/10_rls_tahap1.sql`, `20_rls_tahap2.sql` | **78/78 lolos** |
| Ujung-ke-ujung Tahap 1 (API) | `supabase/tests/e2e_tahap1.mjs` | **36/36 lolos** (regresi aman) |
| Ujung-ke-ujung Tahap 2 (API) | `supabase/tests/e2e_tahap2.mjs` | **28/28 lolos** |
| Alur browser (admin → guru → siswa HP) | Playwright | **20/20 lolos**, termasuk impor 24 siswa dari Excel |

Cakupan uji Tahap 2 antara lain:
- impor massal beserta penolakan per baris,
- kompensasi akun ketika NISN ganda,
- penempatan kelas otomatis,
- bentrok jadwal kelas dan guru,
- semester beda tahun pelajaran ditolak,
- guru hanya melihat siswanya,
- wali kelas hanya melihat kelas binaannya,
- siswa tidak bisa membaca NIP guru maupun data siswa lain,
- salin penugasan Ganjil → Genap,
- audit log.

Menjalankan uji ujung-ke-ujung (**hanya ke proyek uji, bukan produksi**):

```bash
SUPABASE_URL=... ANON_KEY=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... npm run test:e2e
```

---

## 6. Perbaikan kecil di luar data master

- Notifikasi toast dipindah ke **kanan bawah** di desktop (sebelumnya menutupi tombol aksi di kanan atas) dan **atas tengah** di HP.
- Audit log kini menampilkan label berbahasa Indonesia untuk semua jenis aktivitas, plus filter per jenis data.
- Pesan error dari database (nama kelas ganda, NISN terdaftar, data masih dipakai, jadwal bentrok) ditampilkan dalam bahasa Indonesia.
