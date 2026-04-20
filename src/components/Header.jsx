export default function Header() {
  return (
    <header
      className="relative overflow-hidden border-b px-4 md:px-8 pt-8 pb-6"
      style={{
        background: 'linear-gradient(135deg, #0F1117 0%, #1A1D27 55%, #0F1117 100%)',
        borderBottomColor: '#2E3347',
      }}
    >
      {/* Decorative blob */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          right: '-60px', top: '-60px',
          width: '280px', height: '280px',
          background: 'rgba(147,180,250,0.04)',
        }}
      />

      <div className="max-w-[920px] mx-auto">
        <div className="text-[10px] tracking-[3px] uppercase font-bold mb-3 text-text-hint">
          SCB · Design &amp; Experience · v2.0
        </div>

        <h1
          className="font-serif font-normal leading-tight text-text-primary mb-2.5"
          style={{ fontSize: 'clamp(22px, 4vw, 34px)' }}
        >
          UX Feature Evaluation Framework
        </h1>

        <p className="text-[13px] text-text-secondary font-light">
          Rúbrica objetiva de 10 criterios para evaluación de funcionalidades digitales · Santander Consumer Perú
        </p>

        <div className="flex gap-4 mt-6 flex-wrap">
          {[
            ['10',   'Criterios'],
            ['100%', 'Ponderado'],
            ['1–10', 'Escala'],
            ['≥7.5', 'Score mínimo'],
          ].map(([v, l]) => (
            <div
              key={l}
              className="text-center rounded-lg px-5 py-2.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="font-mono text-[22px] font-medium text-accent">{v}</div>
              <div className="text-[10px] text-text-secondary tracking-wider uppercase mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}
