export function getScoreColor(s) {
  if (!s) return '#6B7280'
  if (s >= 8) return '#059669'   // good   — 4.6:1 AA on white
  if (s >= 5) return '#B45309'   // warning — 4.7:1 AA on white
  return '#DC2626'               // danger  — 5.9:1 AA on white
}

export function getScoreBg(s) {
  if (!s) return 'rgba(107,114,128,0.08)'
  if (s >= 8) return '#D1FAE5'   // success-bg
  if (s >= 5) return '#FEF3C7'   // amber-light
  return '#FEE2E2'               // red-light
}

export function calcWeightedScore(scores, criteria) {
  const answered = criteria.filter(c => scores[c.id])
  if (!answered.length) return null
  const totalWeight = answered.reduce((a, c) => a + c.weight, 0)
  const weighted    = answered.reduce((a, c) => a + scores[c.id] * c.weight, 0)
  return (weighted / totalWeight).toFixed(1)
}
