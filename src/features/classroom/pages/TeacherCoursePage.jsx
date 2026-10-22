import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BarChart3, BookOpen, ChevronRight, ClipboardList, FileQuestion, FolderPlus, Megaphone, MessagesSquare, MoreVertical, Paperclip, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Card, ConfirmDialog, DataTable, Dropdown, DropdownItem, EmptyState, ErrorState, Skeleton, SkeletonRows, Tabs } from '@/components/ui'
import { unwrap } from '@/lib/db'
import { toMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { formatRelative } from '@/lib/utils'
import { ckeys, fetchCourseProgress, fetchLessonStats } from '../api'
import { CourseHeader } from '../components/CourseHeader'
import { NewLessonModal } from '../components/NewLessonModal'
import { SectionFormModal } from '../components/SectionFormModal'
import { ProgressBar, PublishBadge } from '../components/status'
import { groupLessons, useCourse, useInvalidateClassroom } from '../hooks'
import { CourseTasksTab } from '@/features/tasks/components/CourseTasksTab'
import { CourseQuizzesTab } from '@/features/quizzes/components/CourseQuizzesTab'
import { CourseForumTab } from '@/features/forum/components/CourseForumTab'
import { AnnouncementList } from '@/features/announcements/components/AnnouncementList'

function LessonsTab({ course, sections, lessons, basePath }) {
  const invalidate = useInvalidateClassroom()
  const stats = useQuery({ queryKey: ckeys.lessonStats(course.id), queryFn: () => fetchLessonStats(course.id) })
  const [sectionModal, setSectionModal] = useState(null)
  const [lessonModal, setLessonModal] = useState(null) // { sectionId }
  const [removeSection, setRemoveSection] = useState(null)
  const [busy, setBusy] = useState(false)
  const groups = groupLessons(sections, lessons)
  const nextNumber = Math.max(0, ...lessons.map((l) => l.meeting_number ?? 0)) + 1

  const move = async (idx, dir) => {
    const a = sections[idx]
    const b = sections[idx + dir]
    if (!b) return
    try {
      // Tukar posisi; nilai posisi dinormalisasi ke indeks agar selalu unik.
      await Promise.all(
        sections.map((s, i) => {
          const pos = s.id === a.id ? idx + dir : s.id === b.id ? idx : i
          return s.position === pos ? null : supabase.from('course_sections').update({ position: pos }).eq('id', s.id)
        }),
      )
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    }
  }

  const doRemoveSection = async () => {
    setBusy(true)
    try {
      unwrap(await supabase.from('course_sections').delete().eq('id', removeSection.id))
      toast.success('Bab dihapus. Pertemuan di dalamnya dipindah ke "Tanpa bab".')
      setRemoveSection(null)
      invalidate()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const published = lessons.filter((l) => l.status === 'published').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{lessons.length}</span> pertemuan · {published} terbit · {lessons.length - published} draf
        </p>
        <div className="flex gap-2">
          <Button variant="outline" icon={FolderPlus} onClick={() => setSectionModal('new')}>Tambah bab</Button>
          <Button icon={Plus} onClick={() => setLessonModal({})}>Tambah pertemuan</Button>
        </div>
      </div>

      {lessons.length === 0 && sections.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Ruang kelas masih kosong"
            description="Susun materi per bab dan pertemuan. Contoh: Bab 1 Bilangan → Pertemuan 1 Bilangan Bulat, Pertemuan 2 Operasi Bilangan."
            action={<Button icon={FolderPlus} onClick={() => setSectionModal('new')}>Buat bab pertama</Button>}
          />
        </Card>
      ) : (
        groups.map(({ section, lessons: list }) => {
          const idx = section ? sections.findIndex((s) => s.id === section.id) : -1
          return (
            <Card key={section?.id ?? 'loose'} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold">{section ? section.title : 'Tanpa bab'}</h3>
                  {section?.description && <p className="mt-0.5 text-xs text-slate-500">{section.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" icon={Plus} onClick={() => setLessonModal({ sectionId: section?.id ?? '' })}>Pertemuan</Button>
                  {section && (
                    <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi bab"><MoreVertical className="h-4 w-4" /></Button>}>
                      <DropdownItem icon={Pencil} onClick={() => setSectionModal(section)}>Ubah bab</DropdownItem>
                      {idx > 0 && <DropdownItem icon={ArrowUp} onClick={() => move(idx, -1)}>Pindah ke atas</DropdownItem>}
                      {idx < sections.length - 1 && <DropdownItem icon={ArrowDown} onClick={() => move(idx, 1)}>Pindah ke bawah</DropdownItem>}
                      <DropdownItem icon={Trash2} danger onClick={() => setRemoveSection(section)}>Hapus bab</DropdownItem>
                    </Dropdown>
                  )}
                </div>
              </div>
              {list.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-400">Belum ada pertemuan di bab ini.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {list.map((l) => {
                    const st = stats.data?.get(l.id)
                    const done = st?.completed ?? 0
                    return (
                      <li key={l.id}>
                        <Link to={`${basePath}/pertemuan/${l.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700">
                            {l.meeting_number ?? '–'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-900">{l.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {l.material_count} materi</span>
                              {l.status === 'published' && <span>{done}/{course.student_count} siswa selesai</span>}
                              <span>diubah {formatRelative(l.updated_at)}</span>
                            </p>
                            {l.status === 'published' && course.student_count > 0 && <ProgressBar value={(done / course.student_count) * 100} className="mt-2 max-w-60" />}
                          </div>
                          <PublishBadge status={l.status} />
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          )
        })
      )}

      <SectionFormModal
        key={sectionModal?.id ?? String(sectionModal)}
        mode={sectionModal}
        taId={course.id}
        nextPosition={sections.length}
        onClose={() => setSectionModal(null)}
        onSaved={() => {
          setSectionModal(null)
          invalidate()
        }}
      />
      <NewLessonModal
        key={lessonModal ? `l-${lessonModal.sectionId}` : 'closed'}
        open={Boolean(lessonModal)}
        taId={course.id}
        sections={sections}
        nextNumber={nextNumber}
        defaultSectionId={lessonModal?.sectionId}
        basePath={basePath}
        onClose={() => setLessonModal(null)}
        onCreated={invalidate}
      />
      <ConfirmDialog
        open={Boolean(removeSection)}
        onClose={() => setRemoveSection(null)}
        onConfirm={doRemoveSection}
        loading={busy}
        title="Hapus bab?"
        confirmLabel="Hapus bab"
        message={removeSection && `Bab "${removeSection.title}" dihapus. Pertemuan di dalamnya TIDAK ikut terhapus, melainkan dipindah ke "Tanpa bab".`}
      />
    </div>
  )
}

function ProgressTab({ course }) {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ckeys.progress(course.id), queryFn: () => fetchCourseProgress(course.id) })
  if (isLoading) return <Card><SkeletonRows rows={6} /></Card>
  if (isError) return <Card><ErrorState error={error} onRetry={refetch} /></Card>
  const rows = data ?? []
  const total = rows[0]?.total ?? 0
  if (rows.length === 0) return <Card><EmptyState icon={Users} title="Belum ada siswa di kelas ini" /></Card>
  const avg = total ? Math.round((rows.reduce((n, r) => n + r.completed, 0) / (rows.length * total)) * 100) : 0
  const notStarted = rows.filter((r) => r.completed + r.in_progress === 0).length

  return (
    <Card>
      <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-3">
        <div><p className="text-xs text-slate-500">Pertemuan terbit</p><p className="font-display text-2xl font-semibold">{total}</p></div>
        <div><p className="text-xs text-slate-500">Rata-rata penyelesaian</p><p className="font-display text-2xl font-semibold">{avg}%</p></div>
        <div><p className="text-xs text-slate-500">Belum membuka materi</p><p className="font-display text-2xl font-semibold text-accent-600">{notStarted} siswa</p></div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.student_id}
        columns={[
          {
            key: 'name',
            header: 'Siswa',
            render: (r) => (
              <div className="flex items-center gap-3">
                <Avatar name={r.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{r.full_name}</p>
                  <p className="text-xs text-slate-500">NISN {r.nisn}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'progress',
            header: 'Penyelesaian',
            className: 'w-64',
            render: (r) => (
              <div className="flex items-center gap-3">
                <ProgressBar value={total ? (r.completed / total) * 100 : 0} className="flex-1" />
                <span className="w-12 text-right text-xs font-medium text-slate-600">{r.completed}/{total}</span>
              </div>
            ),
          },
          { key: 'in_progress', header: 'Sedang dipelajari', render: (r) => r.in_progress || '—' },
          {
            key: 'last',
            header: 'Terakhir belajar',
            render: (r) => (r.last_viewed_at ? formatRelative(r.last_viewed_at) : <Badge tone="orange">Belum pernah</Badge>),
          },
        ]}
      />
    </Card>
  )
}


/** Ruang kelas digital — sisi guru (juga dipakai admin). */
export default function TeacherCoursePage() {
  const { taId } = useParams()
  const { course, sections, lessons } = useCourse(taId)
  const [params, setParams] = useSearchParams()
  const tab = ['tugas', 'kuis', 'diskusi', 'pengumuman', 'progress'].includes(params.get('tab')) ? params.get('tab') : 'lessons'
  const setTab = (v) => setParams(v === 'lessons' ? {} : { tab: v }, { replace: true })
  const basePath = `/guru/kelas/${taId}`

  if (course.isLoading) return <Skeleton className="h-56 rounded-2xl" />
  if (course.isError) return <Card><ErrorState error={course.error} onRetry={course.refetch} /></Card>
  if (!course.data) return <Card><EmptyState icon={BookOpen} title="Ruang kelas tidak ditemukan" description="Anda tidak memiliki akses ke ruang kelas ini." /></Card>
  const c = course.data

  return (
    <div className="space-y-6">
      <CourseHeader course={c} backTo="/guru/kelas" backLabel="Kelas Saya" />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'lessons', label: 'Pertemuan & Materi', icon: BookOpen },
            { value: 'tugas', label: 'Tugas', icon: ClipboardList },
            { value: 'kuis', label: 'Kuis', icon: FileQuestion },
            { value: 'diskusi', label: 'Diskusi', icon: MessagesSquare },
            { value: 'pengumuman', label: 'Pengumuman', icon: Megaphone },
            { value: 'progress', label: 'Progress Siswa', icon: BarChart3 },
          ]}
        />
      </div>
      {tab === 'tugas' ? (
        <CourseTasksTab course={c} />
      ) : tab === 'kuis' ? (
        <CourseQuizzesTab course={c} />
      ) : tab === 'diskusi' ? (
        <CourseForumTab taId={c.id} />
      ) : tab === 'pengumuman' ? (
        <AnnouncementList taId={c.id} defaultTarget={`course:${c.id}`} emptyText="Pengumuman untuk kelas-mapel ini akan muncul di sini." />
      ) : tab === 'lessons' ? (
        sections.isLoading || lessons.isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : sections.isError || lessons.isError ? (
          <Card><ErrorState error={sections.error ?? lessons.error} onRetry={() => { sections.refetch(); lessons.refetch() }} /></Card>
        ) : (
          <LessonsTab course={c} sections={sections.data} lessons={lessons.data} basePath={basePath} />
        )
      ) : (
        <ProgressTab course={c} />
      )}
    </div>
  )
}
