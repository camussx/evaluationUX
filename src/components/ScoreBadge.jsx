import { getScoreColor, getScoreBg } from '../utils/scoring'

export default function ScoreBadge({ score }) {
  if (!score) return null
  const color = getScoreColor(score)
  const bg    = getScoreBg(score)
  return (
    <span
      className="font-mono text-[13px] font-bold px-2.5 py-0.5 rounded border whitespace-nowrap"
      style={{ color, background: bg, borderColor: color }}
    >
      {score}/10
    </span>
  )
}
