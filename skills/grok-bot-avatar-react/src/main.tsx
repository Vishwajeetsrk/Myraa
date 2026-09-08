import { createAvatar } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import definition from '../grok-bot.avatar.json'
import './styles.css'

const ExportedAvatar = createAvatar(definition)
type AnimationName = keyof typeof definition.animations
type ExpressionName = keyof typeof definition.expressions
type Target =
  | { kind: 'animation'; key: AnimationName }
  | { kind: 'expression'; key: ExpressionName }

const animations = definition.animationOrder as AnimationName[]
const expressions = definition.expressionOrder as ExpressionName[]
const initialTarget: Target = animations[0]
  ? { kind: 'animation', key: animations[0] }
  : { kind: 'expression', key: expressions[0] ?? ('neutral' as ExpressionName) }

function App() {
  const [target, setTarget] = useState<Target>(initialTarget)

  return (
    <main>
      <h1>{"Grok bot"}</h1>
      <div className="demo">
        <section className="stage">
          <ExportedAvatar
            {...(target.kind === 'animation'
              ? { animation: target.key }
              : { expression: target.key })}
            size="100%"
            ariaLabel={"Grok bot avatar"}
          />
        </section>
        <aside className="controls">
          <h2>Animations</h2>
          <div className="grid">
            {animations.map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={target.kind === 'animation' && target.key === key}
                onClick={() => setTarget({ kind: 'animation', key })}
              >
                {key}
              </button>
            ))}
          </div>
          <h2>Expressions</h2>
          <div className="grid">
            {expressions.map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={target.kind === 'expression' && target.key === key}
                onClick={() => setTarget({ kind: 'expression', key })}
              >
                {key}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
