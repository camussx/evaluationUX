import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlows } from '../hooks/useFlows'
import { useAuth } from '../hooks/useAuth'
import { getScoreColor } from '../utils/scoring'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—'

// ── Create flow modal ─────────────────────────────────────────────────────────

function NewFlowModal({ onClose, onCreate }) {
  const [name,       setName]       = useState('')
  const [product,    setProduct]    = useState('')
  const [description, setDesc]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const [fieldError, setFieldErr]   = useState('')
  const nameRef                     = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setFieldErr('El nombre es obligatorio.'); return }
    if (!product.trim()) { setFieldErr('El producto es obligatorio.'); return }
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
    'w-full bg-background-elevated border border-border-default rounded-lg px-3.5 py-2.5 ' +
    'text-[13px] text-text-primary placeholder:text-text-hint ' +
    'focus:outline-none focus:border-accent transition-colors duration-150'

  const labelCls =
    'block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-background-surface border border-border-default rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-default">
          <h2 className="text-[16px] font-bold text-text-primary">Registrar flujo</h2>
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
            <label className={labelCls}>
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Onboarding · Transferencias inmediatas"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Producto <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={product}
              onChange={e => setProduct(e.target.value)}
              placeholder="Ej. App Santander · Web Pública · Super Billetera"
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

// ── FlujosPage ────────────────────────────────────────────────────────────────

export default function FlujosPage() {
  const navigate                           = useNavigate()
  const { flows, loading, error, createFlow } = useFlows()
  const { role }                           = useAuth()
  const [showModal, setModal]              = useState(false)
  const isAdmin                            = role === 'admin'

  // Group by product
  const groups = useMemo(() => {
    const map = {}
    for (const flow of flows) {
      const key = flow.product?.trim() || 'Sin producto'
      if (!map[key]) map[key] = []
      map[key].push(flow)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [flows])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!loading && !error && flows.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-text-primary">Flujos</h1>
          {isAdmin && (
            <button
              onClick={() => setModal(true)}
              className="px-4 py-2 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              + Registrar flujo
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-28 border border-dashed border-border-default rounded-xl text-center">
          <p className="text-[15px] text-text-secondary mb-2">No hay flujos registrados</p>
          <p className="text-[13px] text-text-hint mb-6">
            {isAdmin
              ? 'Crea el primer flujo para empezar a registrar evaluaciones.'
              : 'Un administrador debe crear el primer flujo.'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setModal(true)}
              className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              + Registrar flujo
            </button>
          )}
        </div>

        {showModal && (
          <NewFlowModal
            onClose={() => setModal(false)}
            onCreate={createFlow}
          />
        )}
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-[22px] font-bold text-text-primary">Flujos</h1>
        {isAdmin && (
          <button
            onClick={() => setModal(true)}
            className="flex-shrink-0 px-4 py-2 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            + Registrar flujo
          </button>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-danger mb-4">Error al cargar: {error.message}</p>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-8 animate-pulse">
          {[1, 2].map(i => (
            <div key={i}>
              <div className="h-3 w-28 bg-background-elevated rounded mb-3" />
              <div className="bg-background-surface border border-border-default rounded-xl">
                {[1, 2].map(j => (
                  <div key={j} className="flex items-center gap-6 px-5 py-4 border-b border-border-default last:border-b-0">
                    <div className="h-3 w-40 bg-background-elevated rounded" />
                    <div className="h-3 w-20 bg-background-elevated rounded ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product groups */}
      {!loading && (
        <div className="space-y-8">
          {groups.map(([product, productFlows]) => (
            <section key={product}>
              <h2 className="text-[11px] font-bold tracking-[2px] uppercase text-text-hint mb-3 px-1">
                {product}
              </h2>

              <div className="bg-background-surface border border-border-default rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-default bg-background-elevated/40">
                      {['Flujo', 'Descripción', 'Evaluaciones', 'Promedio', 'Creación'].map(h => (
                        <th
                          key={h}
                          className="text-left text-[11px] font-bold tracking-[1px] uppercase text-text-hint py-3 px-4 first:pl-5 last:pr-5"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productFlows.map(flow => {
                      const avg        = flow.avgScore ? parseFloat(flow.avgScore) : null
                      const scoreColor = avg != null ? getScoreColor(avg) : null

                      return (
                        <tr
                          key={flow.id}
                          onClick={() => navigate(`/flujos/${flow.id}`)}
                          className="border-b border-border-default last:border-b-0 hover:bg-background-elevated/40 cursor-pointer transition-colors duration-100"
                        >
                          {/* Flujo */}
                          <td className="py-3.5 px-4 pl-5">
                            <span className="text-[13px] font-semibold text-text-primary">
                              {flow.name}
                            </span>
                          </td>

                          {/* Descripción */}
                          <td className="py-3.5 px-4 text-[13px] text-text-secondary">
                            {flow.description
                              ? flow.description.length > 50
                                ? flow.description.slice(0, 50) + '…'
                                : flow.description
                              : <span className="text-text-hint">—</span>}
                          </td>

                          {/* Evaluaciones */}
                          <td className="py-3.5 px-4 font-mono text-[13px] text-text-secondary">
                            {flow.evalCount > 0
                              ? flow.evalCount
                              : <span className="text-text-hint">—</span>}
                          </td>

                          {/* Promedio */}
                          <td className="py-3.5 px-4">
                            {avg != null ? (
                              <span className="font-mono text-[13px] font-bold" style={{ color: scoreColor }}>
                                {flow.avgScore}
                              </span>
                            ) : (
                              <span className="text-text-hint text-[13px]">—</span>
                            )}
                          </td>

                          {/* Creación */}
                          <td className="py-3.5 px-4 pr-5 text-[13px] text-text-hint whitespace-nowrap">
                            {fmtDate(flow.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Create flow modal */}
      {showModal && (
        <NewFlowModal
          onClose={() => setModal(false)}
          onCreate={createFlow}
        />
      )}
    </div>
  )
}
