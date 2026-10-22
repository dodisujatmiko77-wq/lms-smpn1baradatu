import { FilterSelect } from '@/components/ui'

/** Pemilih kelas (tampil hanya bila lebih dari satu). */
export function ClassPicker({ classes, current, onChange }) {
  if (classes.length < 2) return null
  return (
    <div className="sm:w-56">
      <FilterSelect value={current?.id ?? ''} onChange={onChange} label="Kelas binaan">
        {classes.map((c) => <option key={c.id} value={c.id}>Kelas {c.name}</option>)}
      </FilterSelect>
    </div>
  )
}
