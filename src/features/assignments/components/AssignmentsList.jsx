import { CalendarClock, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Badge, Button, DataTable, Dropdown, DropdownItem } from '@/components/ui'

export function SubjectChip({ subject }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{subject.name}</p>
        <p className="text-xs text-slate-500">{subject.code}</p>
      </div>
    </div>
  )
}

/** Tabel penugasan mengajar (dipakai halaman Penugasan & detail kelas). */
export function AssignmentsList({ rows, hideClass, onEdit, onDelete }) {
  const columns = [
    { key: 'subject', header: 'Mata pelajaran', render: (r) => <SubjectChip subject={r.subject} /> },
    ...(hideClass ? [] : [{ key: 'class', header: 'Kelas', render: (r) => <span className="font-medium">{r.class.name}</span> }]),
    { key: 'teacher', header: 'Guru', render: (r) => r.teacher.profile.full_name },
    { key: 'hours', header: 'Jam/minggu', render: (r) => r.hours_per_week ?? '—' },
    {
      key: 'schedule',
      header: 'Jadwal',
      render: (r) =>
        r.schedule_count ? (
          <Badge tone="green"><CalendarClock className="h-3 w-3" /> {r.schedule_count} sesi</Badge>
        ) : (
          <Badge tone="orange">Belum dijadwalkan</Badge>
        ),
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      actions={
        onEdit &&
        ((r) => (
          <Dropdown trigger={({ toggle }) => <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Aksi"><MoreVertical className="h-4 w-4" /></Button>}>
            <DropdownItem icon={Pencil} onClick={() => onEdit(r)}>Ganti guru / jam</DropdownItem>
            <DropdownItem icon={Trash2} danger onClick={() => onDelete(r)}>Hapus penugasan</DropdownItem>
          </Dropdown>
        ))
      }
    />
  )
}
