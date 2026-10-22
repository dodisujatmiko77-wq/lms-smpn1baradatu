import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Code, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Underline, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function ToolButton({ active, onClick, label, icon: Icon, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-40',
        active && 'bg-primary-50 text-primary-700',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

/** Editor teks kaya (TipTap). Nilai keluar/masuk berupa HTML; tampilan siswa disanitasi ulang. */
export default function RichTextEditor({ value, onChange, placeholder = 'Tulis materi di sini…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, protocols: ['https', 'http', 'mailto'] } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: { attributes: { class: 'prose-lms min-h-[260px] px-4 py-3 focus:outline-none' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        quote: e.isActive('blockquote'),
        code: e.isActive('codeBlock'),
        link: e.isActive('link'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      },
  })

  // Sinkron bila nilai berubah dari luar (mis. data pertemuan selesai dimuat).
  useEffect(() => {
    if (!editor || value === undefined || editor.isFocused) return
    // Di StrictMode (dev) editor bisa sempat dihancurkan; membaca HTML-nya akan gagal → abaikan.
    try {
      if (value !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(value || '', { emitUpdate: false })
    } catch {
      /* editor belum siap / sudah dihancurkan */
    }
  }, [editor, value])

  if (!editor || !state) return <div className="h-72 animate-pulse rounded-xl bg-slate-100" />

  const setLink = () => {
    const prev = editor.getAttributes('link').href ?? ''
    const url = window.prompt('Alamat tautan (https://…)', prev)
    if (url === null) return
    if (url === '') return editor.chain().focus().extendMarkRange('link').unsetLink().run()
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return window.alert('Tautan harus diawali https:// atau http://')
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const c = () => editor.chain().focus()
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/80 px-2 py-1.5">
        <ToolButton icon={Heading2} label="Judul" active={state.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
        <ToolButton icon={Heading3} label="Subjudul" active={state.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton icon={Bold} label="Tebal" active={state.bold} onClick={() => c().toggleBold().run()} />
        <ToolButton icon={Italic} label="Miring" active={state.italic} onClick={() => c().toggleItalic().run()} />
        <ToolButton icon={Underline} label="Garis bawah" active={state.underline} onClick={() => c().toggleUnderline().run()} />
        <ToolButton icon={Strikethrough} label="Coret" active={state.strike} onClick={() => c().toggleStrike().run()} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton icon={List} label="Daftar berbutir" active={state.bullet} onClick={() => c().toggleBulletList().run()} />
        <ToolButton icon={ListOrdered} label="Daftar bernomor" active={state.ordered} onClick={() => c().toggleOrderedList().run()} />
        <ToolButton icon={Quote} label="Kutipan" active={state.quote} onClick={() => c().toggleBlockquote().run()} />
        <ToolButton icon={Code} label="Blok kode" active={state.code} onClick={() => c().toggleCodeBlock().run()} />
        <ToolButton icon={Minus} label="Garis pemisah" onClick={() => c().setHorizontalRule().run()} />
        <ToolButton icon={Link2} label="Tautan" active={state.link} onClick={setLink} />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton icon={Undo2} label="Urungkan" disabled={!state.canUndo} onClick={() => c().undo().run()} />
        <ToolButton icon={Redo2} label="Ulangi" disabled={!state.canRedo} onClick={() => c().redo().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
