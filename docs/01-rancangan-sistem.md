# Rancangan Sistem — LMS Digital UPT SMP Negeri 1 Baradatu

> Status: **DISETUJUI** (21 Oktober 2026). Keputusan A–H mengikuti rekomendasi. Database: **Supabase Free** untuk tahap awal.
> Versi 1.0 · Perubahan setelah persetujuan dicatat di dokumen panduan tiap tahap (`docs/02-…`).

---

## 1. Analisis Kebutuhan

### 1.1 Konteks sekolah dan asumsi skala

| Aspek | Asumsi (mohon dikoreksi bila berbeda) |
|---|---|
| Rombel | ±8–10 rombel per tingkat → ±27 kelas (VII, VIII, IX) |
| Siswa | ±800–950 siswa aktif |
| Guru | ±45–60 guru, sebagian merangkap wali kelas |
| Admin | 2–4 operator (operator sekolah, TU, kurikulum) |
| Mata pelajaran | ±12–14 mapel (Kurikulum Merdeka) |
| Perangkat siswa | Mayoritas smartphone Android kelas menengah–bawah, kuota terbatas |
| Jaringan | Sinyal di Way Kanan bervariasi → aplikasi harus ringan dan toleran koneksi putus |
| Akun siswa | Sebagian besar siswa SMP **tidak punya email pribadi** |

Kesimpulan penting dari asumsi di atas:

1. **Mobile-first** adalah keharusan, bukan tambahan. Bundle JS harus kecil, gambar dikompresi, video lewat YouTube (bukan diunggah).
2. **Login pakai NISN / NIP (username)**, bukan email (lihat Keputusan A).
3. **Beban puncak** terjadi saat ujian serentak (±300 siswa satu tingkat dalam 1 jam). Autosave CBT harus hemat request.
4. Kuota Supabase (terutama storage & egress) harus dijaga sejak desain.

### 1.2 Kebutuhan fungsional (ringkas per aktor)

| Aktor | Kebutuhan inti |
|---|---|
| Admin | Data master, akun pengguna, tahun pelajaran/semester, penugasan mengajar, jadwal, pengaturan sekolah, pengumuman, monitoring, laporan, audit log |
| Guru | Ruang kelas per (kelas × mapel), materi/pertemuan, tugas, kuis/CBT, penilaian & umpan balik, forum, pengumuman kelas, statistik |
| Siswa | Dashboard pribadi, jadwal, materi, tugas, kuis, forum, kalender, nilai, progress, badge, notifikasi |
| Wali kelas | Monitoring lintas mapel untuk kelas binaan (read-only atas konten guru lain) |

### 1.3 Kebutuhan non-fungsional

- **Keamanan**: RLS di semua tabel, tidak ada `service_role` di browser, kunci jawaban tidak pernah terkirim ke siswa sebelum diizinkan.
- **Performa**: halaman pertama < 3 detik di 4G lemah; pagination di semua daftar; realtime hanya untuk notifikasi.
- **Keterpeliharaan**: struktur modular per fitur, migrasi SQL bernomor, konfigurasi sekolah terpusat di database.
- **Auditability**: aksi sensitif (buat/reset akun, ubah nilai, hapus data) tercatat di `audit_logs`.
- **Pemisahan periode**: semua data akademik terikat pada tahun pelajaran dan semester.

---

## 2. Arsitektur Sistem

```
┌───────────────────────────────────────────────────────────┐
│  Browser / HP siswa & guru                                 │
│  React + Vite SPA (Tailwind, React Router, Recharts)       │
│  ├─ supabase-js (anon key + JWT pengguna)                  │
│  └─ TanStack Query (cache, pagination, retry)              │
└──────────────┬──────────────────────────────┬─────────────┘
               │ HTTPS (REST/RPC/Storage)     │ WebSocket (Realtime: notifikasi saja)
┌──────────────▼──────────────────────────────▼─────────────┐
│  Supabase                                                  │
│  ├─ Auth           : identitas, sesi, JWT                  │
│  ├─ PostgreSQL     : tabel + RLS + fungsi RPC (SECURITY    │
│  │                   DEFINER) + trigger + pg_cron          │
│  ├─ Storage        : bucket private + signed URL           │
│  ├─ Realtime       : channel notifikasi per pengguna       │
│  └─ Edge Functions : operasi yang butuh service_role       │
│       • admin-create-user  • admin-reset-password          │
│       • admin-bulk-import  • admin-set-account-status      │
└───────────────────────────────────────────────────────────┘
Hosting frontend: Netlify atau Vercel (static SPA + redirect ke index.html)
```

### 2.1 Prinsip arsitektur

1. **Database adalah sumber kebenaran untuk hak akses.** Frontend menyembunyikan menu demi UX, tetapi setiap baris data dilindungi RLS.
2. **Operasi multi-tabel lewat RPC Postgres** (satu transaksi): mulai ujian, submit ujian, publikasi nilai, kenaikan kelas, penugasan wali kelas.
3. **Operasi yang butuh hak super lewat Edge Function**: membuat akun Auth, reset password, menonaktifkan akun. Edge Function memverifikasi JWT pemanggil adalah admin aktif, lalu mencatat audit log.
4. **"Ruang kelas digital" = `teaching_assignments`** (guru × kelas × mapel × semester). Semua konten pembelajaran (bab, pertemuan, materi, tugas, kuis, forum) menempel pada `teaching_assignment_id`. Ini membuat RLS sederhana dan konsisten.

### 2.2 Stack pendukung (rekomendasi)

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Data fetching & cache | TanStack Query | Mengurangi request berulang, pagination, retry otomatis |
| Form & validasi | React Hook Form + Zod | Ringan, validasi skema yang sama bisa dipakai ulang |
| Rich text editor | TipTap | Modern, ringan, output HTML; disanitasi dengan DOMPurify saat ditampilkan |
| Toast | Sonner | Kecil, rapi |
| Tanggal | date-fns (locale `id`) | Tree-shakeable |
| Export Excel | ExcelJS (lazy-load) | Hanya dimuat saat tombol export diklik |
| Export PDF | jsPDF + autoTable (lazy-load) | Idem |
| Kompresi gambar | browser-image-compression | Foto tugas dari HP dikecilkan sebelum diunggah |

### 2.3 Struktur folder

```
lms-baradatu/
├─ docs/                       # rancangan, panduan uji per tahap
├─ supabase/
│  ├─ migrations/              # 0001_..., 0002_... (bertahap, tidak pernah diedit setelah dijalankan)
│  ├─ functions/               # Edge Functions (Deno)
│  │  ├─ _shared/              # cors, verifikasi admin, audit helper
│  │  ├─ admin-create-user/
│  │  └─ admin-reset-password/
│  └─ seed.sql                 # data awal minimal (1 admin, pengaturan sekolah) — bukan data dummy fitur
├─ public/
├─ src/
│  ├─ app/                     # router, providers, guard route
│  ├─ config/                  # konstanta non-identitas (nama bucket, ukuran halaman)
│  ├─ lib/                     # supabaseClient, queryClient, utils, format
│  ├─ components/
│  │  ├─ ui/                   # Button, Card, Modal, Table, Input, Badge, Skeleton, EmptyState...
│  │  ├─ layout/               # Sidebar, Header, MobileNav, Breadcrumb, PageHeader
│  │  └─ charts/               # pembungkus Recharts
│  ├─ features/                # modul per domain
│  │  ├─ auth/
│  │  ├─ settings/
│  │  ├─ master-data/          # guru, siswa, kelas, mapel, tahun pelajaran, penugasan
│  │  ├─ classroom/            # ruang kelas digital, bab, pertemuan, materi, progress
│  │  ├─ assignments/
│  │  ├─ quizzes/
│  │  ├─ discussions/
│  │  ├─ announcements/
│  │  ├─ notifications/
│  │  ├─ calendar/
│  │  ├─ achievements/
│  │  ├─ monitoring/           # wali kelas
│  │  └─ reports/
│  │     └─ (tiap fitur: api.js, hooks.js, components/, pages/)
│  ├─ hooks/                   # useAuth, useSchoolSettings, useDebounce...
│  ├─ styles/
│  └─ main.jsx
├─ .env.example                # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├─ netlify.toml / vercel.json
└─ package.json
```

---

## 3. Struktur Menu per Role

### 3.1 Administrator
```
Dashboard
Akademik
  ├─ Tahun Pelajaran & Semester
  ├─ Kelas
  ├─ Mata Pelajaran
  ├─ Penugasan Mengajar
  ├─ Wali Kelas
  └─ Jadwal Pelajaran
Pengguna
  ├─ Akun Pengguna (buat, aktif/nonaktif, reset password)
  ├─ Data Guru
  ├─ Data Siswa (termasuk impor Excel & penempatan kelas)
Pembelajaran
  ├─ Monitoring Pembelajaran
  ├─ Monitoring Tugas & Pengumpulan
  └─ Manajemen File
Komunikasi
  └─ Pengumuman Sekolah
Laporan
  ├─ Aktivitas Guru / Aktivitas Siswa
  ├─ Rekap Tugas & Nilai / Rekap Kuis
  └─ Progress Pembelajaran
Sistem
  ├─ Pengaturan Sekolah
  ├─ Pengaturan Sistem (ukuran file, jenis file, notifikasi, publikasi)
  └─ Audit Log
```

### 3.2 Guru Mata Pelajaran
```
Dashboard
Kelas Saya            → daftar ruang kelas (kelas × mapel)
  └─ [Ruang Kelas]: Beranda · Materi & Pertemuan · Tugas · Kuis/Ujian · Diskusi · Siswa & Progress · Pengumuman
Jadwal Mengajar
Bank Soal
Pemeriksaan           → antrean tugas & esai yang belum dinilai (lintas kelas)
Kalender
Laporan Pembelajaran
Profil
```

### 3.3 Wali Kelas (menu tambahan pada akun guru, muncul bila tercatat di `class_guardians` semester aktif)
```
Kelas Binaan
  ├─ Dashboard Kelas
  ├─ Daftar Siswa
  ├─ Monitoring Tugas (lintas mapel)
  ├─ Keaktifan Belajar
  ├─ Siswa Perlu Tindak Lanjut
  └─ Laporan Kelas
```

### 3.4 Siswa
```
Beranda (Dashboard)
Mata Pelajaran        → ruang kelas: Materi · Tugas · Kuis · Diskusi · Progress
Tugas                 → Belum dikerjakan / Terkumpul / Dinilai
Kuis & Ujian
Jadwal
Kalender
Nilai & Umpan Balik
Pencapaian (Badge)
Profil
```
Mobile: bottom navigation 5 item (Beranda, Mapel, Tugas, Kalender, Profil) + menu lainnya di drawer.

---

## 4. Rancangan Database Supabase

### 4.1 Diagram relasi (ringkas)

```
auth.users ─1:1─ profiles ─1:N─ user_roles (admin | teacher | student)
                   ├─1:1─ teachers
                   └─1:1─ students

academic_years ─1:N─ semesters (is_active: tepat satu aktif)
academic_years ─1:N─ classes (VII-A 2026/2027)
classes ─1:N─ class_enrollments ─N:1─ students         (per tahun pelajaran)
classes ─1:N─ class_guardians   ─N:1─ teachers         (per semester)

teaching_assignments  = teacher × class × subject × semester   ◄── "RUANG KELAS DIGITAL"
  ├─ schedules (hari, jam ke-, ruang)
  ├─ course_sections (Bab) ─1:N─ lessons (Pertemuan) ─1:N─ lesson_materials
  │                                     └─ lesson_progress (per siswa)
  ├─ assignments ─1:N─ assignment_submissions ─1:1─ assignment_grades
  ├─ quizzes ─N:M─ quiz_questions (via quiz_question_items) ─1:N─ quiz_options
  │     └─ quiz_attempts ─1:N─ quiz_answers
  ├─ discussion_topics ─1:N─ discussion_replies (self-reference parent_id)
  └─ announcements (scope: school | class | teaching_assignment)

question_banks (milik guru × mapel) ─1:N─ quiz_questions
teaching_assignment_grants  (hak akses khusus dari admin ke guru lain)
notifications (per user) · achievements ─N:M─ students (student_achievements)
audit_logs · school_settings (satu baris) · activity_events (log aktivitas ringan)
```

### 4.2 Tabel dan kolom kunci

Semua tabel: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger otomatis) kecuali tabel log.

| Tabel | Kolom penting | Catatan |
|---|---|---|
| `profiles` | id (= auth.users.id), full_name, username (NISN/NIP), avatar_path, phone, is_active | Data pribadi dasar |
| `user_roles` | user_id, role (enum) | Unique(user_id, role); satu orang bisa admin + guru |
| `teachers` | profile_id, nip, nuptk, gender | |
| `students` | profile_id, nisn, nis, gender, birth_date, status (aktif/lulus/pindah) | Data sensitif → RLS ketat |
| `academic_years` | name (2026/2027), start_date, end_date, is_active | |
| `semesters` | academic_year_id, number (1/2), start_date, end_date, is_active | Partial unique index: hanya satu aktif |
| `classes` | academic_year_id, grade (7/8/9), name (VII-A), room | |
| `class_enrollments` | class_id, student_id, academic_year_id | Unique(student_id, academic_year_id) |
| `subjects` | code, name, color, icon | |
| `teaching_assignments` | teacher_id, class_id, subject_id, semester_id | Unique(class, subject, semester) |
| `teaching_assignment_grants` | teaching_assignment_id, teacher_id, permission (view/edit), granted_by | Hak akses khusus |
| `class_guardians` | class_id, teacher_id, semester_id | |
| `schedules` | teaching_assignment_id, day_of_week, start_time, end_time, room | |
| `course_sections` | teaching_assignment_id, title, position | Bab/topik |
| `lessons` | section_id, teaching_assignment_id*, title, meeting_number, content_html, status (draft/published), publish_at | *denormalisasi untuk RLS cepat |
| `lesson_materials` | lesson_id, type (pdf/image/youtube/link/file/presentation), title, storage_path / url, size_bytes, position | |
| `lesson_progress` | lesson_id, student_id, status (in_progress/completed), last_viewed_at, completed_at | Unique(lesson_id, student_id) |
| `assignments` | teaching_assignment_id, lesson_id?, title, description, instructions, submission_type[], start_at, due_at, max_score, allow_late, status | |
| `assignment_submissions` | assignment_id, student_id, status (draft/submitted), text_answer, link_url, files jsonb, submitted_at, is_late (generated) | Unique(assignment_id, student_id) |
| `assignment_grades` | submission_id, score, feedback, graded_by, published_at | Siswa hanya lihat bila published_at ≠ null |
| `question_banks` | teacher_id, subject_id, grade, name | |
| `quiz_questions` | bank_id, type (mcq/true_false/short/essay), body_html, answer_key, explanation, points | answer_key **tidak bisa dibaca siswa** |
| `quiz_options` | question_id, body, is_correct, position | **tidak bisa dibaca siswa langsung** |
| `quizzes` | teaching_assignment_id, kind (quiz/exam), title, open_at, close_at, duration_minutes, max_attempts, shuffle_questions, shuffle_options, review_mode (never/after_submit/after_close), status | |
| `quiz_question_items` | quiz_id, question_id, position, points_override | Soal dari bank dipakai ulang |
| `quiz_attempts` | quiz_id, student_id, attempt_no, started_at, deadline_at (server), submitted_at, status, score_auto, score_manual, question_order jsonb | |
| `quiz_answers` | attempt_id, question_id, selected_option_id, text_answer, is_correct, score, graded_by | Unique(attempt_id, question_id) |
| `discussion_topics` | teaching_assignment_id, author_id, title, body, is_pinned, is_locked, is_hidden | |
| `discussion_replies` | topic_id, parent_id, author_id, body, is_hidden, hidden_by | Moderasi oleh guru |
| `announcements` | scope, class_id?, teaching_assignment_id?, title, body, author_id, publish_at, is_pinned | |
| `notifications` | user_id, type, title, body, link, is_read, created_at | Index (user_id, is_read, created_at desc) |
| `achievements` | code, name, description, icon, rule jsonb | |
| `student_achievements` | student_id, achievement_id, semester_id, awarded_at | |
| `activity_events` | user_id, event_type, teaching_assignment_id, ref_id, created_at | Untuk grafik aktivitas & keaktifan; dipartisi/dibersihkan berkala |
| `audit_logs` | actor_id, action, table_name, record_id, old_data, new_data, ip, created_at | Hanya admin yang baca; tidak bisa diubah/dihapus |
| `school_settings` | school_name, short_name, address, logo_path, app_name, active_semester_id, max_upload_mb, allowed_mime_types[], notification_prefs jsonb, material_requires_publish | Satu baris |

### 4.3 Strategi RLS

Fungsi helper (`SECURITY DEFINER`, `STABLE`, dipanggil sebagai `(select fn())` agar dievaluasi sekali per query):

```
is_admin()                         → user punya role admin dan is_active
current_teacher_id() / current_student_id()
can_manage_ta(ta_id)               → guru pemilik ATAU grant 'edit' ATAU admin
can_view_ta(ta_id)                 → can_manage_ta ATAU wali kelas kelas tsb ATAU siswa terdaftar di kelas tsb
is_guardian_of_class(class_id)
```

Contoh aturan:

| Data | Siswa | Guru | Wali kelas | Admin |
|---|---|---|---|---|
| Materi/pertemuan | Baca bila published & kelasnya | CRUD milik sendiri | Baca kelas binaan | Semua |
| Tugas | Baca bila published & kelasnya | CRUD milik sendiri | Baca | Semua |
| Pengumpulan | CRUD milik sendiri (sebelum dinilai) | Baca + nilai di kelasnya | Baca | Semua |
| Nilai | Baca milik sendiri bila dipublikasi | CRUD di kelasnya | Baca | Semua |
| Soal & kunci | **Tidak ada akses langsung** | CRUD bank sendiri | Tidak | Semua |
| Data siswa lain | Hanya nama & foto teman sekelas (via view) | Siswa di kelas yang diajar | Siswa kelas binaan | Semua |
| Audit log | Tidak | Tidak | Tidak | Baca saja |

### 4.4 Alur CBT yang aman

1. `rpc start_quiz_attempt(quiz_id)` → validasi jadwal, batas percobaan, kelas; set `started_at = now()`, `deadline_at = least(now() + durasi, close_at)`; acak urutan soal/opsi dan simpan di attempt.
2. `rpc get_attempt_questions(attempt_id)` → mengembalikan soal & opsi **tanpa** `is_correct`/`answer_key`, plus `server_now` dan `deadline_at`. Timer di browser hanya menghitung mundur dari selisih waktu server.
3. `rpc save_answer(attempt_id, question_id, …)` → ditolak bila `now() > deadline_at`. Autosave di-debounce (mis. 2 detik setelah berhenti mengetik / langsung saat memilih opsi) + antrean lokal bila koneksi putus.
4. `rpc submit_attempt(attempt_id)` → koreksi otomatis soal objektif dalam transaksi. Attempt yang lewat deadline otomatis disubmit oleh pg_cron (tiap menit) atau saat diakses berikutnya.
5. `rpc get_attempt_review(attempt_id)` → kunci & pembahasan hanya dikirim bila `review_mode` mengizinkan.

### 4.5 Storage

| Bucket | Akses | Isi | Pola path |
|---|---|---|---|
| `public-assets` | public read, admin write | Logo sekolah, ikon badge | `school/logo.png` |
| `avatars` | private, signed URL | Foto profil (dikompresi ≤ 200 KB) | `{user_id}/avatar.webp` |
| `materials` | private, signed URL | PDF, PPT, dokumen, gambar materi | `{teaching_assignment_id}/{lesson_id}/{file}` |
| `submissions` | private, signed URL | Berkas pengumpulan tugas | `{assignment_id}/{student_id}/{file}` |

Storage policy membaca segmen path (`storage.foldername(name)`) lalu memanggil helper RLS yang sama (`can_manage_ta`, `can_view_ta`, kepemilikan siswa). Signed URL berlaku 10–60 menit.

### 4.6 Notifikasi & otomatisasi

- **Trigger DB** membuat notifikasi saat: materi dipublikasi, tugas dipublikasi, nilai dipublikasi, pengumuman dibuat (fan-out ke siswa kelas terkait, ±32 baris per kelas — aman).
- **pg_cron**: pengingat tenggat H-1, auto-submit ujian kadaluarsa, pemberian badge mingguan, pembersihan `activity_events` lama.
- **Realtime**: satu channel per pengguna, filter `user_id=eq.<id>` pada tabel `notifications`. Tidak ada subscription realtime lain kecuali (opsional) forum yang sedang dibuka.

### 4.7 Urutan migrasi

```
0001_extensions_enums_helpers.sql      (pgcrypto, enum role, trigger updated_at)
0002_profiles_roles_settings.sql       (Tahap 1)
0003_academic_master.sql               (Tahap 2)
0004_rls_helpers_master_policies.sql   (Tahap 2)
0005_classroom_lessons.sql             (Tahap 3)
0006_storage_buckets_policies.sql      (Tahap 3)
0007_assignments.sql                   (Tahap 4)
0008_quizzes_cbt.sql + rpc             (Tahap 5)
0009_discussions_announcements_notifications.sql (Tahap 6)
0010_achievements_activity_cron.sql    (Tahap 6–7)
0011_reports_views.sql                 (Tahap 7)
```
Setiap migrasi disertai skrip uji RLS (login sebagai siswa/guru/admin dan pastikan akses ditolak/diizinkan sesuai tabel 4.3).

---

## 5. Konsep Desain Dashboard

### 5.1 Design tokens

| Token | Nilai | Pemakaian |
|---|---|---|
| Primary | Biru `#1D4ED8` (skala 50–900) | Tombol utama, sidebar aktif, link |
| Secondary | Oranye `#F97316` | Aksen, badge "baru", tenggat dekat |
| Success | Hijau `#16A34A` | Selesai, terkumpul, dinilai |
| Danger / Warning | Merah `#DC2626` / Kuning `#EAB308` | Terlambat, peringatan |
| Background | `#F8FAFC` dengan kartu putih | |
| Heading | Poppins 600/700 | |
| Body | Inter 400/500 | |
| Radius | 12px kartu, 10px input/tombol | |
| Shadow | `0 1px 2px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.04)` | |
| Transisi | 150–200 ms ease-out | Hover, buka sidebar, modal |

### 5.2 Layout

```
┌────────────┬──────────────────────────────────────────────────────┐
│  LOGO      │ Dashboard            🔍 Cari...        🔔(3)  [foto▾] │
│  LMS       │ Beranda / Dashboard                                   │
│            ├──────────────────────────────────────────────────────┤
│ ▣ Dashboard│ Selamat pagi, Rina 👋   Senin, 21 Oktober 2026        │
│ ▢ Mapel    │ ┌──────────┬──────────┬──────────┬──────────┐         │
│ ▢ Tugas    │ │ Tugas    │ Materi   │ Rata-rata│ Badge    │         │
│ ▢ Kuis     │ │ aktif 4  │ selesai  │ kuis 82  │ 3        │         │
│ ▢ Kalender │ │ (oranye) │ 68% (biru│ (hijau)  │ (ungu)   │         │
│ ▢ Nilai    │ └──────────┴──────────┴──────────┴──────────┘         │
│            │ ┌───────────────────────────┐ ┌─────────────────────┐ │
│ ── Akun ── │ │ Jadwal hari ini (timeline)│ │ Tugas mendatang     │ │
│ ▢ Profil   │ └───────────────────────────┘ │ (countdown tenggat) │ │
│            │ ┌───────────────────────────┐ └─────────────────────┘ │
│ [Keluar]   │ │ Progress per mapel (bar)  │ ┌─────────────────────┐ │
│            │ └───────────────────────────┘ │ Pengumuman          │ │
└────────────┴───────────────────────────────┴─────────────────────┘
```

- **Desktop ≥1280px**: sidebar penuh 260px.
- **Tablet 768–1279px**: sidebar bisa diciutkan menjadi ikon 72px (preferensi diingat).
- **HP <768px**: sidebar menjadi drawer; siswa mendapat bottom navigation; tabel berubah menjadi daftar kartu.

### 5.3 Pola komponen

- Kartu statistik berwarna dengan ikon dalam lingkaran lembut dan tren kecil.
- Kartu pertemuan dengan status (abu "Belum dimulai", biru "Sedang dipelajari", hijau "Selesai") dan progress ring.
- Skeleton loading pada setiap kartu/tabel, empty state dengan ilustrasi ringan dan tombol aksi, toast untuk hasil aksi, modal konfirmasi untuk hapus/publikasi/submit ujian.
- Halaman ujian: mode fokus (tanpa sidebar), navigasi nomor soal, indikator "tersimpan otomatis", timer menempel di atas.

---

## 6. Roadmap Implementasi

| Tahap | Ruang lingkup | Hasil yang bisa diuji |
|---|---|---|
| **1. Fondasi** | Vite + React + Tailwind, router, Supabase client, design system dasar, layout (sidebar/header/mobile nav), login (username/password), reset password, route guard per role, migrasi 0001–0002, Edge Function `admin-create-user` minimal, pengaturan sekolah terpusat (baca) | Admin pertama login → diarahkan ke dashboard admin; siswa/guru tidak bisa membuka rute admin; akun nonaktif ditolak |
| **2. Data Master** | Tahun pelajaran & semester, kelas, mapel, guru, siswa (+ impor Excel), penempatan siswa, penugasan mengajar, wali kelas, jadwal, manajemen akun (buat/nonaktif/reset + audit) | CRUD lengkap + uji RLS |
| **3. Pembelajaran** | Ruang kelas digital, bab, pertemuan, materi (TipTap, PDF viewer, YouTube embed, unggah file), publikasi, tandai selesai, progress | Guru membuat → siswa kelas tsb melihat; siswa kelas lain tidak |
| **4. Tugas** | Buat tugas, pengumpulan (teks/file/gambar/link), status, dashboard pemeriksaan, nilai & umpan balik, publikasi nilai | Alur lengkap guru ↔ siswa, termasuk terlambat |
| **5. Kuis & CBT** | Bank soal, susun kuis, jadwal, pengacakan, timer server, autosave, koreksi otomatis, penilaian esai, hasil & pembahasan | Uji kunci jawaban tidak bocor, uji timer, uji koneksi putus |
| **6. Interaksi** | Forum + moderasi, pengumuman, notifikasi realtime, kalender, badge | |
| **7. Monitoring & Laporan** | Dashboard analitik semua role, monitoring wali kelas, laporan dengan filter, export Excel/PDF | |
| **8. Penyempurnaan** | Audit keamanan RLS, optimasi index/query, uji beban sederhana, aksesibilitas, PWA opsional, panduan deploy & panduan pengguna | |

Setiap tahap diakhiri dengan: daftar migrasi, petunjuk menjalankan, dan **checklist pengujian** (simpan/baca/ubah/hapus + kontrol akses).

---

## 7. Risiko dan Mitigasi

### 7.1 Keamanan

| Risiko | Mitigasi |
|---|---|
| Kebocoran `service_role` key | Hanya ada di secrets Edge Function; `.env` frontend hanya berisi URL + anon key |
| RLS lupa diaktifkan pada tabel baru | Setiap migrasi wajib `enable row level security`; skrip cek tabel tanpa RLS di Tahap 8 |
| Siswa membaca kunci jawaban via API langsung | Tabel soal/opsi tidak punya policy SELECT untuk siswa; akses hanya via RPC yang menyaring kolom |
| Manipulasi timer di perangkat | Deadline dihitung & ditegakkan di server (`save_answer` menolak lewat waktu) |
| Siswa mengubah nilai / status submission | Kolom nilai di tabel terpisah; siswa tidak punya policy UPDATE di `assignment_grades` |
| XSS lewat rich text / forum | Sanitasi DOMPurify saat render, CSP dasar di hosting |
| File berbahaya diunggah | Whitelist MIME & ekstensi (dari `school_settings`), batas ukuran di bucket, file tidak pernah dieksekusi |
| Password lemah / berbagi akun | Password awal acak, wajib ganti saat login pertama, reset hanya oleh admin (tercatat di audit log) |
| Brute force login | Rate limit bawaan Supabase Auth + pesan error generik |
| Data pribadi siswa (NISN, tanggal lahir) | Hanya admin, wali kelas, dan guru terkait; siswa lain hanya melihat nama & foto |

### 7.2 Performa

| Risiko | Mitigasi |
|---|---|
| Ujian serentak ratusan siswa | RPC ringan, autosave debounce, index pada `quiz_answers(attempt_id)`; target < 1 request/5 detik/siswa |
| RLS lambat pada tabel besar | Helper `STABLE` dibungkus `(select …)`, kolom `teaching_assignment_id` didenormalisasi, index pada kolom filter RLS |
| Query dashboard berat | View/RPC agregat, cache TanStack Query 1–5 menit, bukan hitung di browser |
| Koneksi realtime berlebihan | Satu channel per pengguna; free tier membatasi koneksi bersamaan (±200) → realtime hanya untuk notifikasi, fallback polling |
| Bundle besar di HP murah | Code splitting per rute, lazy-load editor, chart, dan library export |

### 7.3 Storage & kuota Supabase

Perkiraan kuota paket Free (angka dapat berubah — mohon cek dashboard Supabase): DB 500 MB, Storage 1 GB, egress ±5 GB/bulan, proyek dijeda setelah 7 hari tanpa aktivitas.

Perkiraan beban: 900 siswa × 2 tugas file/minggu × 300 KB ≈ **540 MB/minggu** bila tanpa kendali → paket Free akan penuh dalam 2–3 minggu.

Mitigasi:
1. **Video wajib via YouTube**, tidak diunggah ke storage.
2. **Kompresi gambar di browser** (maks 1600px, WebP, ±200–300 KB).
3. Batas ukuran per file (default 5 MB dokumen, 2 MB gambar) dapat diatur admin.
4. Utamakan jenis pengumpulan teks/link (mis. Google Drive) bila memungkinkan.
5. Fitur **arsip & bersihkan** berkas pengumpulan semester lalu (dengan konfirmasi admin, setelah export).
6. Dashboard penggunaan storage di menu Manajemen File.
7. **Rekomendasi**: untuk pemakaian penuh sekolah, gunakan paket **Supabase Pro** (±US$25/bulan) — 8 GB DB, 100 GB storage, 250 GB egress, tanpa auto-pause. Free tier cukup untuk pengembangan & uji coba 1–2 kelas.

---

## 8. Keputusan Arsitektur yang Perlu Disetujui

| # | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| A | Cara login | (1) Email asli · (2) Username NISN/NIP dipetakan ke email internal `nisn@siswa.lms.local` · (3) Kombinasi | **(2)** — siswa tidak perlu email; reset password lewat admin. Guru boleh menambah email asli untuk reset mandiri |
| B | Pembuatan akun | (1) Satu per satu · (2) + impor Excel massal | **(2)** via Edge Function, password awal acak + wajib ganti |
| C | Penyimpanan kunci jawaban | (1) Tabel terpisah · (2) Tabel sama, akses siswa hanya via RPC | **(2)** — lebih sederhana, tetap aman |
| D | Rich text editor | TipTap · Quill · Editor.js | **TipTap** |
| E | Bahasa | JavaScript · TypeScript | **JavaScript (JSX)** + JSDoc/Zod — lebih mudah dipelihara guru/operator; TypeScript bila tim developer siap |
| F | Kenaikan kelas | Manual · RPC "naik kelas" per tahun pelajaran | **RPC** di Tahap 2 lanjutan / Tahap 8 |
| G | Hosting | Netlify · Vercel | Keduanya didukung; **Netlify** sedikit lebih sederhana untuk SPA |
| H | Paket Supabase | Free untuk dev → Pro untuk produksi | **Free (dev) → Pro (produksi)** |
