import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../lib/supabase'
import { CRITERIA } from '../data/criteria'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—'

const slugify = (str) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const today = () => new Date().toISOString().split('T')[0]

// ── Data fetch ────────────────────────────────────────────────────────────────

export async function fetchExportData(flowId) {
  const [flowRes, evalsRes] = await Promise.all([
    supabase.from('flows').select('*').eq('id', flowId).single(),
    supabase
      .from('evaluations')
      .select('*, evaluation_criteria(*), evaluation_evaluators(user_id)')
      .eq('flow_id', flowId)
      .order('evaluated_at', { ascending: true }),
  ])

  if (flowRes.error)  throw flowRes.error
  if (evalsRes.error) throw evalsRes.error

  const evaluations = evalsRes.data ?? []

  // Fetch profiles for all evaluators referenced
  const userIds = [...new Set(
    evaluations.flatMap(e => (e.evaluation_evaluators ?? []).map(ee => ee.user_id))
  )]
  let profiles = []
  if (userIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)
    profiles = data ?? []
  }

  const avgScore = evaluations.length > 0
    ? (evaluations.reduce((s, e) => s + parseFloat(e.overall_score), 0) / evaluations.length).toFixed(1)
    : null

  return { flow: flowRes.data, evaluations, profiles, avgScore }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function getEvaluatorEmails(ev, profiles) {
  return (ev.evaluation_evaluators ?? [])
    .map(ee => profiles.find(p => p.id === ee.user_id)?.email ?? ee.user_id.slice(0, 8) + '…')
    .join(', ')
}

function getSortedCriteria(ev) {
  return [...(ev.evaluation_criteria ?? [])]
    .sort((a, b) => a.criterion_id - b.criterion_id)
    .map(ec => ({
      ...ec,
      criterionName: CRITERIA.find(c => c.id === ec.criterion_id)?.name ?? `Criterio ${ec.criterion_id}`,
      contribution:  ((ec.score * ec.weight) / 100).toFixed(2),
    }))
}

// ── Excel export ──────────────────────────────────────────────────────────────

export async function exportToExcel(flowId) {
  const { flow, evaluations, profiles, avgScore } = await fetchExportData(flowId)

  const wb  = XLSX.utils.book_new()

  // ── Sheet 1: Resumen ──────────────────────────────────────────────────────

  const rows = []

  // Sección 1 — Información del flujo
  rows.push(['INFORMACIÓN DEL FLUJO'])
  rows.push(['Nombre del flujo',      flow.name])
  rows.push(['Producto',              flow.product      || '—'])
  rows.push(['Descripción',           flow.description  || '—'])
  rows.push(['Fecha de creación',     fmtDate(flow.created_at)])
  rows.push(['Score general',         avgScore ?? '—'])
  rows.push(['Total de evaluaciones', evaluations.length])
  rows.push([])  // separador

  // Sección 2 — Historial de evaluaciones
  rows.push(['HISTORIAL DE EVALUACIONES'])
  rows.push([])

  for (const ev of evaluations) {
    const score    = parseFloat(ev.overall_score)
    const emails   = getEvaluatorEmails(ev, profiles)
    const criteria = getSortedCriteria(ev)

    rows.push([`Evaluación — ${fmtDate(ev.evaluated_at)}`, '', '', `Score: ${score.toFixed(2)}`])
    if (emails) rows.push(['Evaluadores:', emails, '', ''])
    rows.push(['Criterio', 'Peso', 'Score', 'Contribución al score'])

    for (const ec of criteria) {
      rows.push([
        ec.criterionName,
        `${ec.weight}%`,
        `${ec.score}/10`,
        `${ec.contribution} pts`,
      ])
    }

    rows.push([])   // separador entre evaluaciones
  }

  const ws1 = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws1['!cols'] = [
    { wch: 45 },  // A
    { wch: 12 },  // B
    { wch: 12 },  // C
    { wch: 22 },  // D
  ]

  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

  // ── Sheet 2: Criterios ────────────────────────────────────────────────────

  const criteriaRows = [
    ['N°', 'Nombre', 'Dimensión', 'Peso', 'Descripción'],
    ...CRITERIA.map(c => [c.id, c.name, c.dim, `${c.weight}%`, c.description]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(criteriaRows)
  ws2['!cols'] = [
    { wch: 4 },
    { wch: 35 },
    { wch: 18 },
    { wch: 8 },
    { wch: 80 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Criterios')

  // ── Save ──────────────────────────────────────────────────────────────────

  XLSX.writeFile(wb, `evaluacion-${slugify(flow.name)}-${today()}.xlsx`)
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function exportToPdf(flowId) {
  const { flow, evaluations, profiles, avgScore } = await fetchExportData(flowId)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw   = doc.internal.pageSize.getWidth()
  const ML   = 14   // margin left
  const MR   = pw - 14  // right edge

  // ── Accent color RGB ──────────────────────────────────────────────────────

  const ACCENT = [91, 95, 199]    // #5B5FC7
  const GRAY   = [107, 114, 128]  // #6B7280
  const DARK   = [26, 29, 53]     // #1A1D35
  const LIGHT  = [248, 249, 252]  // #F8F9FC

  // ── Header helper ─────────────────────────────────────────────────────────

  function drawPageHeader(isFirst) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(isFirst ? 16 : 10)
    doc.setTextColor(...DARK)
    doc.text('UX Evaluation Framework', ML, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    const exportDate = new Date().toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
    doc.text(exportDate, MR, 14, { align: 'right' })

    if (isFirst) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...ACCENT)
      doc.text(flow.name, ML, 21)
    }

    // Divider
    doc.setDrawColor(229, 231, 235)  // #E5E7EB
    doc.setLineWidth(0.4)
    doc.line(ML, isFirst ? 25 : 18, MR, isFirst ? 25 : 18)
  }

  // ── Page 1 ────────────────────────────────────────────────────────────────

  drawPageHeader(true)
  let y = 32

  // Sección 1 — Info del flujo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text('Información del flujo', ML, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML },
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: DARK,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: GRAY, cellWidth: 52 },
      1: { cellWidth: 'auto' },
    },
    body: [
      ['Producto',              flow.product     || '—'],
      ['Descripción',           flow.description || '—'],
      ['Fecha de creación',     fmtDate(flow.created_at)],
      ['Score general',         avgScore ? `${avgScore} / 10` : '—'],
      ['Total de evaluaciones', `${evaluations.length}`],
    ],
  })

  y = doc.lastAutoTable.finalY + 8

  // Sección 2 — Historial de evaluaciones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text('Historial de evaluaciones', ML, y)
  y += 4

  for (const ev of evaluations) {
    const score    = parseFloat(ev.overall_score)
    const emails   = getEvaluatorEmails(ev, profiles)
    const criteria = getSortedCriteria(ev)

    // Add new page if near the bottom
    if (y > doc.internal.pageSize.getHeight() - 55) {
      doc.addPage()
      drawPageHeader(false)
      y = 26
    }

    // Evaluation title row
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text(`${fmtDate(ev.evaluated_at)}  ·  Score: ${score.toFixed(2)}`, ML, y)

    if (emails) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      y += 4
      doc.text(`Evaluadores: ${emails}`, ML, y)
    }

    y += 2

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: ML },
      head: [['Criterio', 'Peso', 'Score', 'Contribución']],
      body: criteria.map(ec => [
        ec.criterionName,
        `${ec.weight}%`,
        `${ec.score}/10`,
        `${ec.contribution} pts`,
      ]),
      styles: {
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: ACCENT,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
      },
      didDrawPage: () => {
        // Ensure header on continuation pages
        drawPageHeader(false)
      },
    })

    y = doc.lastAutoTable.finalY + 8
  }

  // Sección 3 — Referencia de criterios (nueva página si no cabe)
  if (y > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage()
    drawPageHeader(false)
    y = 26
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text('Referencia de criterios', ML, y)
  y += 4

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: ML },
    head: [['N°', 'Nombre', 'Dimensión', 'Peso', 'Descripción']],
    body: CRITERIA.map(c => [c.id, c.name, c.dim, `${c.weight}%`, c.description]),
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 24 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 'auto' },
    },
    didDrawPage: () => { drawPageHeader(false) },
  })

  // ── Footer on all pages ───────────────────────────────────────────────────

  const totalPages = doc.internal.getNumberOfPages()
  const ph         = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text('UX Evaluation Framework · Design & Experience', ML, ph - 8)
    doc.text(`Página ${i} de ${totalPages}`, MR, ph - 8, { align: 'right' })
    // Footer divider
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    doc.line(ML, ph - 12, MR, ph - 12)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  doc.save(`evaluacion-${slugify(flow.name)}-${today()}.pdf`)
}
