export default function WeightBar({ weight, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-1.5 rounded"
        style={{ width: weight * 4, background: color, opacity: 0.85 }}
      />
      <span className="text-[11px] font-bold text-text-secondary font-mono">{weight}%</span>
    </div>
  )
}
