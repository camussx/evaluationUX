import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlows } from '../hooks/useFlows'
import { useAuth } from '../hooks/useAuth'
import { getScoreColor, getScoreBg } from '../utils/scoring'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-background-surface border border-border-default rounded-xl p-5 animate-pulse">
      <div className="h-3 w-16 bg-background-elevated rounded mb-3" />
      <div className="h-5 w-3/4 bg-background-elevated rounded mb-4" />
      <div className="h-3 w-full bg-background-elevated rounded mb-2" />
      <div className="h-3 w-2/3 bg-background-elevated rounded mb-5" />
      <div className="h-4 w-1/3 bg-background-elevated rounded" />
    </div>
  )
}

// ── Flow card ────────────────────────────────────────────────────────────────

function FlowCard({ flow, onClick }) {
  const sc = getScoreColor(flow.lastScore)
  const sb = getScoreBg(flow.lastScore)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-background-surface border border-border-default rounded-xl p-5 transition-all duration-200 hover:border-accent/60 hover:bg-background-elevated group focus:outline-none focus:ring-2 focus:ring-accent/50"
    >
      {/* Top row: product tag + score badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-text-hint">
          {flow.product || 'Sin producto'}
        </span>
        {flow.lastScore != null ? (
          <span
            className="font-mono text-[12px] font-bold px-2 py-0.5 rounded border flex-shrink-0"
            style={{ color: sc, background: sb, borderColor: sc }}
          >
            {parseFloat(flow.lastScore).toFixed(1)}/10
          </span>
        ) : (
          <span className="text-[10px] text-text-hint italic flex-shrink-0">Sin evaluar</span>
        )}
      </div>

      {/* Flow name */}
      <h3 className="text-[15px] font-bold text-text-primary mb-2 group-hover:text-accent transition-colors duration-200 leading-snug">
        {flow.name}
      </h3>

      {/* Description */}
      {flow.description && (
        <p className="text-[12px] text-text-hint mb-4 leading-relaxed line-clamp-2">
          {flow.description}
        </p>
      )}

      {/* Footer: last evaluation date or creation date */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border-default">
        <span className="text-[11px] text-text-hint">
          {flow.lastEvaluatedAt
            ? `Última eval: ${fmtDate(flow.lastEvaluatedAt)}`
            : `Creado: ${fmtDate(flow.created_at)}`}
        </span>
        <span className="text-accent text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          Ver →
        </span>
      </div>
    </button>
  )
}

// ── New flow modal ────────────────────────────────────────────────────────────

function NewFlowModal({ onClose, onCreate }) {
  const [name, setName]           = useState('')
  const [product, setProduct]     = useState('')
  const [description, setDesc]    = useState('')
  const [saving, setSaving]       = useState(false)
  const [fieldError, setFieldErr] = useState('')
  const nameRef                   = useRef(null)

  // Focus name field and listen for Escape
  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setFieldErr('El nombre es obligatorio.'); return }
    setSaving(true)
    setFieldErr('')
    try {
      const flow = await onCreate({ name, product, description })
      onClose(flow)
    } catch (err) {
      setFieldErr(err.message || 'Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full bg-background-elevated border border-border-default rounded-lg px-3 py-2.5 ' +
    'text-[13px] text-text-primary placeholder:text-text-hint ' +
    'focus:outline-none focus:border-accent transition-colors duration-150'

  const labelCls = 'block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-background-surface border border-border-default rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-default">
          <h2 className="text-[16px] font-bold text-text-primary">Nuevo flujo</h2>
          <button
            onClick={onClose}
            className="text-text-hint hover:text-text-primary transition-colors text-xl leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Nombre <span className="text-danger">*</span></label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Onboarding digital · Transferencias"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Producto / App</label>
            <input
              type="text"
              value={product}
              onChange={e => setProduct(e.target.value)}
              placeholder="Ej. App Mobile, Web Banking"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Contexto breve del flujo evaluado…"
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </div>

          {fieldError && (
            <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {fieldError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border-default text-[13px] text-text-secondary hover:text-text-primary hover:border-text-hint transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-background-base text-[13px] font-bold transition-opacity disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Crear flujo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── FlowsPage ─────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const navigate              = useNavigate()
  const { flows, loading, error, createFlow } = useFlows()
  const { role }              = useAuth()
  const [showModal, setModal] = useState(false)
  const isAdmin               = role === 'admin'

  async function handleCreate(fields) {
    const flow = await createFlow(fields)  // throws on error
    return flow
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Flujos registrados</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Cada flujo agrupa el historial de evaluaciones de un feature o recorrido de usuario.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal(true)}
            className="flex-shrink-0 px-4 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            + Nuevo flujo
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-danger/30 bg-danger/8 text-danger text-[13px]">
          Error al cargar flujos: {error.message}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && flows.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border-default rounded-xl">
          <div className="text-4xl mb-4">📂</div>
          <p className="text-text-primary font-semibold mb-1">No hay flujos todavía</p>
          <p className="text-[13px] text-text-secondary mb-6">
            {isAdmin
              ? 'Crea el primero para empezar a registrar evaluaciones.'
              : 'Un administrador debe crear el primer flujo.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setModal(true)}
              className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              + Crear primer flujo
            </button>
          )}
        </div>
      )}

      {/* Flows grid */}
      {!loading && flows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(f => (
            <FlowCard
              key={f.id}
              flow={f}
              onClick={() => navigate(`/flows/${f.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <NewFlowModal
          onClose={() => setModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
