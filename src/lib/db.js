/** Mengembalikan data atau melempar error dari respons Supabase. */
export function unwrap({ data, error }) {
  if (error) throw error
  return data
}
