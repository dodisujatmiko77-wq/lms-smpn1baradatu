// Ekspor laporan ke Excel (ExcelJS) & PDF (jsPDF + autoTable). Library dimuat hanya saat tombol ditekan.
import { formatDate } from '@/lib/utils'

const safe = (s) => s.replace(/[\\/:*?"<>|]/g, '-')

function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/**
 * columns: [{ header, key, width?, numFmt? }]
 * rows: objek dengan kunci sesuai columns (nilai kosong = null).
 */
export async function exportExcel({ fileName, school, title, subtitle, columns, rows }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = school ?? 'LMS'
  const ws = wb.addWorksheet('Laporan', { views: [{ state: 'frozen', ySplit: 5 }] })
  ws.addRow([school ?? ''])
  ws.addRow([title])
  ws.addRow([subtitle ?? ''])
  ws.addRow([`Dicetak ${formatDate(new Date(), "d MMMM yyyy 'pukul' HH:mm")}`])
  ws.getRow(1).font = { bold: true, size: 12 }
  ws.getRow(2).font = { bold: true, size: 14 }
  ws.getRow(4).font = { italic: true, color: { argb: 'FF64748B' } }
  const header = ws.addRow(columns.map((c) => c.header))
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  for (const r of rows) ws.addRow(columns.map((c) => (r[c.key] ?? null)))
  columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? Math.min(40, Math.max(10, c.header.length + 2))
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt
  })
  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), safe(`${fileName}.xlsx`))
}

export async function exportPdf({ fileName, school, title, subtitle, columns, rows, landscape }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const orientation = landscape ?? columns.length > 7 ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(school ?? '', 14, 14)
  doc.setFontSize(14)
  doc.text(title, 14, 21)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text([subtitle, `Dicetak ${formatDate(new Date(), "d MMMM yyyy 'pukul' HH:mm")}`].filter(Boolean), 14, 27)
  autoTable(doc, {
    startY: subtitle ? 35 : 31,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => (r[c.key] ?? '–'))),
    styles: { fontSize: columns.length > 10 ? 6.5 : 8, cellPadding: 1.5 },
    headStyles: { fillColor: [29, 78, 216] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Halaman ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 25, doc.internal.pageSize.getHeight() - 6)
    },
  })
  doc.save(safe(`${fileName}.pdf`))
}
