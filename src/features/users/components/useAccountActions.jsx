import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui'
import { toMessage } from '@/lib/errors'
import { adminUsers } from '../api'
import { CredentialModal } from './CredentialModal'

/**
 * Aksi akun yang dipakai ulang (Data Guru / Data Siswa): reset password & aktif/nonaktif.
 * user: { profile_id, full_name, username, is_active }
 */
export function useAccountActions({ onChanged } = {}) {
  const [confirm, setConfirm] = useState(null)
  const [credential, setCredential] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const { type, user } = confirm
    setBusy(true)
    try {
      if (type === 'reset') {
        const res = await adminUsers({ action: 'reset_password', user_id: user.profile_id })
        setCredential({ title: 'Password berhasil direset', full_name: user.full_name, username: user.username, password: res.password })
      } else {
        await adminUsers({ action: 'set_status', user_id: user.profile_id, is_active: !user.is_active })
        toast.success(user.is_active ? `Akun ${user.full_name} dinonaktifkan.` : `Akun ${user.full_name} diaktifkan.`)
      }
      setConfirm(null)
      onChanged?.()
    } catch (e) {
      toast.error(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const element = (
    <>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={run}
        loading={busy}
        tone={confirm?.type === 'status' && confirm.user.is_active ? 'danger' : 'primary'}
        title={confirm?.type === 'reset' ? 'Reset password?' : confirm?.user.is_active ? 'Nonaktifkan akun?' : 'Aktifkan akun?'}
        confirmLabel={confirm?.type === 'reset' ? 'Reset password' : confirm?.user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        message={
          confirm?.type === 'reset'
            ? `Password ${confirm.user.full_name} diganti dengan password sementara baru dan semua sesi login-nya diakhiri.`
            : confirm?.user.is_active
              ? `${confirm?.user.full_name} tidak akan bisa login sampai diaktifkan kembali. Datanya tetap tersimpan.`
              : `${confirm?.user.full_name} akan dapat login kembali.`
        }
      />
      <CredentialModal credential={credential} onClose={() => setCredential(null)} />
    </>
  )

  return {
    resetPassword: (user) => setConfirm({ type: 'reset', user }),
    toggleStatus: (user) => setConfirm({ type: 'status', user }),
    showCredential: setCredential,
    element,
  }
}
