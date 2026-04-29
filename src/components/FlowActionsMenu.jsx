import { useState, useRef, useEffect } from 'react'
import { exportToExcel, exportToPdf } from '../utils/exportFlow'

// ── FlowActionsMenu ───────────────────────────────────────────────────────────
//
// Renders a ··· button per flow row. On click it opens:
//   • sm+ screens  → dropdown anchored to the button
//   • mobile       → bottom sheet overlay
//
// Props:
//   flowId   — UUID of the flow
//   hasEvals — bool: whether the flow has at least one evaluation
//
// If !hasEvals the button is disabled with a tooltip.

export default function FlowActionsMenu({ flowId, hasEvals }) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(null)  // 'excel' | 'pdf' | null
  const [error,   setError]   = useState('')
  const menuRef = useRef(null)

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open) return
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setError('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  async function handleExport(type) {
    setLoading(type)
    setError('')
    try {
      if (type === 'excel') await exportToExcel(flowId)
      else                  await exportToPdf(flowId)
      setOpen(false)
    } catch (err) {
      setError('No se pudo generar el archivo. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  // ── Disabled state ────────────────────────────────────────────────────────

  if (!hasEvals) {
    return (
      <button
        disabled
        title="Realiza al menos una evaluación para exportar."
        className="text-[16px] font-bold px-2 py-0.5 rounded text-text-hint/40 cursor-not-allowed select-none"
      >
        ···
      </button>
    )
  }

  // ── Menu items (shared between dropdown and bottom sheet) ─────────────────

  const items = [
    { type: 'excel', icon: '📊', label: 'Exportar como Excel' },
    { type: 'pdf',   icon: '📄', label: 'Exportar como PDF'   },
  ]

  return (
    <div className="relative" ref={menuRef}>

      {/* ··· trigger */}
      <button
        onClick={() => { setOpen(o => !o); setError('') }}
        className="text-[16px] font-bold px-2 py-0.5 rounded-lg hover:bg-background-elevated transition-colors text-text-secondary"
        aria-label="Acciones del flujo"
      >
        ···
      </button>

      {open && (
        <>
          {/* ── Desktop dropdown (hidden on mobile) ──────────────────────── */}
          <div className="hidden sm:block absolute right-0 top-9 z-30 w-52 bg-background-surface border border-border-default rounded-xl shadow-xl py-1 overflow-hidden">
            {items.map(item => (
              <button
                key={item.type}
                onClick={() => handleExport(item.type)}
                disabled={!!loading}
                className="w-full text-left px-4 py-2.5 text-[13px] text-text-primary hover:bg-background-elevated transition-colors disabled:opacity-50 flex items-center gap-2.5"
              >
                <span>{item.icon}</span>
                <span>{loading === item.type ? 'Generando…' : item.label}</span>
              </button>
            ))}
            {error && (
              <p className="px-4 py-2 text-[11px] text-danger border-t border-border-default">
                {error}
              </p>
            )}
          </div>

          {/* ── Mobile bottom sheet (hidden on sm+) ──────────────────────── */}
          <div
            className="sm:hidden fixed inset-0 z-50"
            onClick={() => { setOpen(false); setError('') }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-background-surface rounded-t-2xl px-5 pt-4 pb-10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-9 h-1 rounded-full bg-border-strong mx-auto mb-4" />

              <p className="text-[13px] font-bold text-text-primary mb-3">
                Exportar resultados
              </p>

              <div className="space-y-2">
                {items.map(item => (
                  <button
                    key={item.type}
                    onClick={() => handleExport(item.type)}
                    disabled={!!loading}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border-default text-[13px] text-text-primary hover:bg-background-elevated transition-colors disabled:opacity-50"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{loading === item.type ? 'Generando…' : item.label}</span>
                  </button>
                ))}
              </div>

              {error && (
                <p className="mt-3 text-[12px] text-danger text-center">{error}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
