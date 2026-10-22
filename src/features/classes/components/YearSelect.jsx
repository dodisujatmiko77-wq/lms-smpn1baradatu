import { FilterSelect } from '@/components/ui'

export function YearSelect({ years = [], value, onChange, className }) {
  return (
    <FilterSelect value={value ?? ''} onChange={onChange} label="Tahun pelajaran" className={className}>
      {years.length === 0 && <option value="">Belum ada tahun pelajaran</option>}
      {years.map((y) => (
        <option key={y.id} value={y.id}>
          TP {y.name}
          {y.is_active ? ' (aktif)' : ''}
        </option>
      ))}
    </FilterSelect>
  )
}
