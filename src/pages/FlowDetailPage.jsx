import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useFlow } from '../hooks/useFlows'
import { getScoreColor, getScoreBg } from '../utils/scoring'
import { CRITERIA } from '../data/criteria'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('es-PE', opts) : '—'

const fmtShort = (iso) =>
  fmtDate(iso, { day: '2-digit', month: '2-digit' })

// ── Chart components ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const score = payload[0]?.value
  const color = getScoreColor(score)
  return (
    <div
      className="rounded-lg px-3 py-2 border shadow-xl text-left"
      style={{ background: '#1A1D27', borderColor: '#2E3347' }}
    >
      <p className="text-[11px] text-text-secondary mb-1">{label}</p>
      <p className="text-[20px] font-bold font-mono" style={{ color }}>
        {score?.toFixed(1)}<span className="text-[13px] text-text-hint">/10</span>
      </p>
    </div>
  )
}

function ScoreChart({ evaluations }) {
  if (evaluations.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        {evaluations.length === 1 ? (
          <>
            <div className="font-mono text-[48px] font-bold mb-2"
              style={{ color: getScoreColor(parseFloat(evaluations[0].overall_score)) }}>
              {parseFloat(evaluations[0].overall_score).toFixed(1)}
            </div>
            <p className="text-text-secondary text-[13px]">Score único</p>
            <p className="text-text-hint text-[12px] mt-1">
              Agrega más evaluaciones para ver la tendencia en el tiempo.
            </p>
          </>
        ) : (
          <p className="text-text-hint text-[13px]">
            Aún no hay evaluaciones para este flujo.
          </p>
        )}
      </div>
    )
  }

  const data = evaluations.map(e => ({
    date:  fmtShort(e.evaluated_at),
    score: parseFloat(e.overall_score),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#93B4FA" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#93B4FA" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#2E3347" vertical={false} />

        <XAxis
          dataKey="date"
          stroke="#2E3347"
          tick={{ fill: '#6B7280', fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2.5, 5, 7.5, 10]}
          stroke="#2E3347"
          tick={{ fill: '#6B7280', fontSize: 11 }}
          tickLine={false}
        />

        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#2E3347' }} />

        {/* Threshold lines */}
        <ReferenceLine
          y={7.5}
          stroke="#34D399"
          strokeDasharray="4 3"
          label={{ value: '7.5 Aprobado', position: 'right', fill: '#34D399', fontSize: 10 }}
        />
        <ReferenceLine
          y={5}
          stroke="#FBBF24"
          strokeDasharray="4 3"
          label={{ value: '5.0 Mínimo', position: 'right', fill: '#FBBF24', fontSize: 10 }}
        />

        <Area
          type="monotone"
          dataKey="score"
          stroke="#93B4FA"
          strokeWidth={2.5}
          fill="url(#scoreGrad)"
          dot={{ r: 4, fill: '#93B4FA', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#93B4FA', stroke: '#0F1117', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Evaluation detail modal ───────────────────────────────────────────────────

function EvalDetailModal({ evaluation, onClose }) {
  const sc = getScoreColor(parseFloat(evaluation.overall_score))
  const sb = getScoreBg(parseFloat(evaluation.overall_score))

  const criteriaRows = evaluation.evaluation_criteria
    .slice()
    .sort((a, b) => a.criterion_id - b.criterion_id)
    .map(ec => ({
      ...ec,
      name: CRITERIA.find(c => c.id === ec.criterion_id)?.name ?? `Criterio ${ec.criterion_id}`,
      contribution: (ec.score * ec.weight) / 100,
    }))

  const evaluatorCount = evaluation.evaluation_evaluators?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background-surface border border-border-default rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border-default flex-shrink-0">
          <div>
            <p className="text-[11px] text-text-hint uppercase tracking-wider mb-1">
              {fmtDate(evaluation.evaluated_at)}
              {evaluatorCount > 0 && ` · ${evaluatorCount} evaluador${evaluatorCount !== 1 ? 'es' : ''}`}
            </p>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-bold text-text-primary">Detalle de evaluación</h2>
              <span
                className="font-mono text-[14px] font-bold px-2.5 py-0.5 rounded border"
                style={{ color: sc, background: sb, borderColor: sc }}
              >
                {parseFloat(evaluation.overall_score).toFixed(2)}/10
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-hint hover:text-text-primary transition-colors text-xl leading-none ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Criteria table */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="space-y-1.5">
            {criteriaRows.map(ec => {
              const scoreColor = getScoreColor(ec.score)
              return (
                <div
                  key={ec.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-background-elevated"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-text-primary truncate">{ec.name}</p>
                    <p className="text-[11px] text-text-hint">Peso: {ec.weight}%</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className="font-mono text-[13px] font-bold"
                      style={{ color: scoreColor }}
                    >
                      {ec.score}/10
                    </span>
                    <p className="text-[10px] text-text-hint">{ec.contribution.toFixed(2)} pts</p>
                  </div>
                </div>
              )
            })}
          </div>

          {evaluation.notes && (
            <div className="mt-4 p-3 bg-background-elevated rounded-lg border border-border-default">
              <p className="text-[11px] font-semibold text-text-hint uppercase tracking-wider mb-1.5">
                Notas
              </p>
              <p className="text-[13px] text-text-secondary leading-relaxed">{evaluation.notes}</p>
            </div>
          )}
        </div>

        {/* Append-only notice inside the modal */}
        <div className="px-6 py-3 border-t border-border-default bg-background-elevated/60 rounded-b-2xl flex-shrink-0">
          <p className="text-[11px] text-text-hint text-center">
            🔒 Las evaluaciones son de solo lectura. El historial no puede modificarse ni eliminarse.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Evaluation history table ──────────────────────────────────────────────────

function EvaluationTable({ evaluations, onViewDetail }) {
  // Display newest-first (evaluations come oldest-first from the hook)
  const rows = [...evaluations].reverse()

  if (!rows.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border-default">
            {['Fecha', 'Score', 'Evaluadores', 'Notas', ''].map(h => (
              <th
                key={h}
                className="text-left text-[10px] font-bold tracking-[1.5px] uppercase text-text-hint py-2.5 px-3 first:pl-0 last:pr-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(ev => {
            const sc = getScoreColor(parseFloat(ev.overall_score))
            const sb = getScoreBg(parseFloat(ev.overall_score))
            const evaluatorCount = ev.evaluation_evaluators?.length ?? 0

            return (
              <tr
                key={ev.id}
                className="border-b border-border-default last:border-b-0 hover:bg-background-elevated/40 transition-colors"
              >
                {/* Fecha */}
                <td className="py-3 px-3 pl-0 text-text-secondary whitespace-nowrap">
                  {fmtDate(ev.evaluated_at)}
                </td>

                {/* Score */}
                <td className="py-3 px-3">
                  <span
                    className="font-mono text-[13px] font-bold px-2 py-0.5 rounded border"
                    style={{ color: sc, background: sb, borderColor: sc }}
                  >
                    {parseFloat(ev.overall_score).toFixed(2)}
                  </span>
                </td>

                {/* Evaluadores */}
                <td className="py-3 px-3 text-text-secondary">
                  {evaluatorCount > 0
                    ? `${evaluatorCount} evaluador${evaluatorCount !== 1 ? 'es' : ''}`
                    : <span className="text-text-hint">—</span>}
                </td>

                {/* Notas */}
                <td className="py-3 px-3 text-text-hint max-w-[200px]">
                  {ev.notes
                    ? <span className="line-clamp-1" title={ev.notes}>{ev.notes}</span>
                    : '—'}
                </td>

                {/* Ver detalle */}
                <td className="py-3 px-3 pr-0 text-right">
                  <button
                    onClick={() => onViewDetail(ev)}
                    className="text-[12px] text-accent font-semibold hover:underline focus:outline-none"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── FlowDetailPage ────────────────────────────────────────────────────────────

export default function FlowDetailPage() {
  const { id }                    = useParams()
  const navigate                  = useNavigate()
  const { flow, evaluations, loading, error } = useFlow(id)
  const [detailEval, setDetail]   = useState(null)

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-background-elevated rounded" />
        <div className="h-8 w-64 bg-background-elevated rounded" />
        <div className="h-[260px] bg-background-surface border border-border-default rounded-xl" />
        <div className="h-[200px] bg-background-surface border border-border-default rounded-xl" />
      </div>
    )
  }

  // ── Error / not found ──
  if (error || !flow) {
    return (
      <div className="text-center py-20">
        <p className="text-danger mb-4">{error?.message ?? 'Flujo no encontrado.'}</p>
        <Link to="/flows" className="text-accent text-[13px] hover:underline">
          ← Volver a flujos
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[12px] text-text-hint mb-5">
        <Link to="/flows" className="hover:text-accent transition-colors">Flujos</Link>
        <span>/</span>
        <span className="text-text-secondary truncate">{flow.name}</span>
      </nav>

      {/* Flow header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          {flow.product && (
            <span className="text-[10px] font-bold tracking-widest uppercase text-text-hint block mb-1">
              {flow.product}
            </span>
          )}
          <h1 className="text-[24px] font-bold text-text-primary leading-snug">{flow.name}</h1>
          {flow.description && (
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-xl">{flow.description}</p>
          )}
        </div>
        <button
          onClick={() => navigate(`/flows/${id}/evaluate`)}
          className="flex-shrink-0 px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nueva evaluación
        </button>
      </div>

      {/* Score trend chart */}
      <div className="bg-background-surface border border-border-default rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-text-primary">Evolución del score</h2>
            <p className="text-[12px] text-text-hint mt-0.5">
              {evaluations.length} evaluación{evaluations.length !== 1 ? 'es' : ''} registrada{evaluations.length !== 1 ? 's' : ''}
            </p>
          </div>
          {evaluations.length >= 2 && (
            <div className="flex items-center gap-4 text-[11px] text-text-hint">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-px border-t-2 border-dashed border-success" />
                7.5 Aprobado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-px border-t-2 border-dashed border-warning" />
                5.0 Mínimo
              </span>
            </div>
          )}
        </div>
        <ScoreChart evaluations={evaluations} />
      </div>

      {/* ─── Append-only notice ──────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg border mb-4 text-[12px]"
        style={{
          background: 'rgba(147,180,250,0.06)',
          borderColor: 'rgba(147,180,250,0.2)',
          color: '#93B4FA',
        }}
      >
        <span className="flex-shrink-0 mt-px">🔒</span>
        <span>
          <strong>Historial de solo lectura.</strong> Las evaluaciones son registros permanentes
          del estado del producto en un momento dado. No pueden editarse ni eliminarse para
          preservar la trazabilidad y auditoría del proceso de evaluación.
        </span>
      </div>

      {/* Evaluation history */}
      <div className="bg-background-surface border border-border-default rounded-xl p-5">
        <h2 className="text-[15px] font-bold text-text-primary mb-4">
          Historial de evaluaciones
        </h2>

        {evaluations.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border-default rounded-xl">
            <p className="text-text-secondary font-semibold mb-1">Sin evaluaciones aún</p>
            <p className="text-[12px] text-text-hint mb-5">
              La primera evaluación marcará el punto de partida del historial.
            </p>
            <button
              onClick={() => navigate(`/flows/${id}/evaluate`)}
              className="px-5 py-2.5 bg-accent text-background-base text-[13px] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              + Crear primera evaluación
            </button>
          </div>
        ) : (
          <EvaluationTable
            evaluations={evaluations}
            onViewDetail={setDetail}
          />
        )}
      </div>

      {/* Detail modal */}
      {detailEval && (
        <EvalDetailModal
          evaluation={detailEval}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
