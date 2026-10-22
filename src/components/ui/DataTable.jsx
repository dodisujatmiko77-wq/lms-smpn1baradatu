import { cn } from '@/lib/utils'

/**
 * Tabel responsif: tabel biasa di ≥md, daftar kartu di HP.
 * columns: [{ key, header, render?(row), className?, hideOnMobile?, mobileLabel? }]
 */
export function DataTable({ columns, rows, rowKey = (r) => r.id, onRowClick, actions, selectable, selected, onToggle, onToggleAll, className }) {
  const allChecked = selectable && rows.length > 0 && rows.every((r) => selected.has(rowKey(r)))
  const cell = (col, row) => (col.render ? col.render(row) : (row[col.key] ?? '—'))

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              {selectable && (
                <th className="w-10 px-5 py-3">
                  <input type="checkbox" checked={allChecked} onChange={() => onToggleAll(!allChecked)} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300 accent-primary-600" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn('px-5 py-3 whitespace-nowrap', c.className)}>
                  {c.header}
                </th>
              ))}
              {actions && <th className="w-12 px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('hover:bg-slate-50/60', onRowClick && 'cursor-pointer', selectable && selected.has(rowKey(row)) && 'bg-primary-50/40')}
              >
                {selectable && (
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(rowKey(row))} onChange={() => onToggle(rowKey(row))} aria-label="Pilih baris" className="h-4 w-4 rounded border-slate-300 accent-primary-600" />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-5 py-3', c.className)}>
                    {cell(c, row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => {
          const [first, ...rest] = columns.filter((c) => !c.hideOnMobile)
          return (
            <li
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('flex items-start gap-3 p-4', onRowClick && 'cursor-pointer active:bg-slate-50')}
            >
              {selectable && (
                <input
                  type="checkbox"
                  checked={selected.has(rowKey(row))}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggle(rowKey(row))}
                  aria-label="Pilih baris"
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-primary-600"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="text-sm">{cell(first, row)}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {rest.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-slate-500">{c.mobileLabel ?? c.header}</dt>
                      <dd className="truncate text-slate-700">{cell(c, row)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {actions && <div onClick={(e) => e.stopPropagation()}>{actions(row)}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
