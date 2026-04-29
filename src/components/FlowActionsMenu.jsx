import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { exportToExcel, exportToPdf } from '../utils/exportFlow'

// ── FlowActionsMenu ───────────────────────────────────────────────────────────
//
// ··· button rendered inline; dropdown rendered via React Portal into
// document.body so it is never clipped by table overflow:hidden.
//
// Position is computed from the trigger button's getBoundingClientRect():
//   • Opens downward if there is room below, upward otherwise.
//   • Right-aligned to the button's right edge.
//
// Mobile: fixed bottom sheet (not affected by portal logic).

const ITEMS = [
  { type: 'excel', icon: '📊', label: 'Exportar como Excel' },
  { type: 'pdf',   icon: '📄', label: 'Exportar como PDF'   },
]

const MENU_HEIGHT = 112   // approx px (2 items × 42px + padding)

export default function FlowActionsMenu({ flowId, hasEvals }) {
  const [open,    setOpen]    = useState(false)
  const [pos,     setPos]     = useState({ top: 0, right: 0 })
  const [loading, setLoading] = useState(null)   // 'excel' | 'pdf' | null
  const [error,   setError]   = useState('')

  const btnRef      = useRef(null)
  const dropdownRef = useRef(null)

  // ── Open: capture button position ────────────────────────────────────────

  function handleOpen() {
    if (!btnRef.current) return
    const rect       = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < MENU_HEIGHT + 8

    setPos({
      top:   openUpward ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
    setError('')
    setOpen(true)
  }

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    function onOutside(e) {
      const inBtn      = btnRef.current?.contains(e.target)
      const inDropdown = dropdownRef.current?.contains(e.target)
      if (!inBtn && !inDropdown) {
        setOpen(false)
        setError('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  // ── Export handler ────────────────────────────────────────────────────────

  async function handleExport(type) {
    setLoading(type)
    setError('')
    try {
      if (type === 'excel') await exportToExcel(flowId)
      else                  await exportToPdf(flowId)
      setOpen(false)
    } catch {
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

  // ── Portal dropdown (desktop) ─────────────────────────────────────────────

  const portalDropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          className="hidden sm:block fixed z-[9999] w-52 bg-background-surface border border-border-default rounded-xl shadow-xl py-1 overflow-hidden"
          style={{ top: pos.top, right: pos.right }}
        >
          {ITEMS.map(item => (
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
        </div>,
        document.body
      )
    : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ··· trigger button */}
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="text-[16px] font-bold px-2 py-0.5 rounded-lg hover:bg-background-elevated transition-colors text-text-secondary"
        aria-label="Acciones del flujo"
      >
        ···
      </button>

      {/* Desktop dropdown via portal */}
      {portalDropdown}

      {/* Mobile bottom sheet (not a portal — fixed inset works fine on mobile) */}
      {open && (
        <div
          className="sm:hidden fixed inset-0 z-50"
          onClick={() => { setOpen(false); setError('') }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-background-surface rounded-t-2xl px-5 pt-4 pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-border-strong mx-auto mb-4" />
            <p className="text-[13px] font-bold text-text-primary mb-3">
              Exportar resultados
            </p>
            <div className="space-y-2">
              {ITEMS.map(item => (
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
      )}
    </>
  )
}
