import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useSchoolSettings } from '@/app/providers/SettingsProvider'
import { Button, Dropdown, DropdownItem } from '@/components/ui'
import { exportExcel, exportPdf } from '../export'

/** Tombol "Unduh" (Excel/PDF). build() mengembalikan { fileName, title, subtitle, columns, rows }. */
export function ExportButtons({ build, disabled }) {
  const { school_name } = useSchoolSettings()
  const [busy, setBusy] = useState(false)
  const run = async (fn) => {
    setBusy(true)
    try {
      await fn({ ...build(), school: school_name })
    } catch (e) {
      toast.error(`Gagal membuat berkas: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dropdown trigger={({ toggle }) => <Button variant="outline" icon={Download} loading={busy} disabled={disabled} onClick={toggle}>Unduh</Button>}>
      <DropdownItem icon={FileSpreadsheet} onClick={() => run(exportExcel)}>Excel (.xlsx)</DropdownItem>
      <DropdownItem icon={FileText} onClick={() => run(exportPdf)}>PDF</DropdownItem>
    </Dropdown>
  )
}
