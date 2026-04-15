export function getScoreColor(s) {
  if (!s) return '#9CA3B8'
  if (s >= 8) return '#34D399'
  if (s >= 5) return '#FBBF24'
  return '#F87171'
}

export function getScoreBg(s) {
  if (!s) return 'rgba(34,38,58,0.5)'
  if (s >= 8) return 'rgba(52,211,153,0.1)'
  if (s >= 5) return 'rgba(251,191,36,0.1)'
  return 'rgba(248,113,113,0.1)'
}

export function calcWeightedScore(scores, criteria) {
  const answered = criteria.filter(c => scores[c.id])
  if (!answered.length) return null
  const totalWeight = answered.reduce((a, c) => a + c.weight, 0)
  const weighted    = answered.reduce((a, c) => a + scores[c.id] * c.weight, 0)
  return (weighted / totalWeight).toFixed(1)
}
