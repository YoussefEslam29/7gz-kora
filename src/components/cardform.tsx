// The fields of the player card, used by Edit my card and the Welcome steps.
// Tapping a chosen foot or position again clears it.
import * as m from 'motion/react-m'
import { FEET, POSITIONS, SKILLS } from '../lib/card'
import type { CardFields, Foot, Position, Skills } from '../lib/types'
import { ScoreButton } from './ui'

type Change = (changes: Partial<CardFields>) => void

/** Shirt number 1-99; empty (or 0) is none. */
export function ShirtField({ value, onChange }: { value: number | null; onChange: Change }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Shirt number</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        placeholder="None"
        value={value ?? ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
          const n = Number(digits)
          onChange({ shirt_number: digits === '' || n === 0 ? null : n })
        }}
        className="tabular mt-1 block h-12 w-28 rounded-xl border-[1.5px] border-line bg-paper px-3 font-display text-2xl"
      />
    </label>
  )
}

export function FootField({ value, onChange }: { value: Foot | null; onChange: Change }) {
  return (
    <div>
      <p className="text-sm font-medium">Strong foot</p>
      <div className="seg mt-1" role="group" aria-label="Strong foot">
        {FEET.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={value === f.value}
            className={`px-4 font-sans text-sm font-bold ${value === f.value ? 'sel' : ''}`}
            onClick={() => onChange({ strong_foot: value === f.value ? null : f.value })}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PositionField({ value, onChange }: { value: Position | null; onChange: Change }) {
  return (
    <div>
      <p className="text-sm font-medium">
        Favourite position <span className="font-normal text-muted">(for show: teams have no fixed positions)</span>
      </p>
      <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Favourite position">
        {POSITIONS.map((p) => (
          <m.button
            key={p.value}
            type="button"
            whileTap={{ scale: 0.94 }}
            aria-pressed={value === p.value}
            onClick={() => onChange({ favourite_position: value === p.value ? null : p.value })}
            className={`min-h-12 rounded-full border-2 px-4 font-semibold ${
              value === p.value ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-line bg-paper text-ink'
            }`}
          >
            {p.label}
          </m.button>
        ))}
      </div>
    </div>
  )
}

export function MottoField({ value, onChange }: { value: string | null; onChange: Change }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Motto</span>
      <input
        value={value ?? ''}
        maxLength={60}
        dir="auto"
        placeholder="Pass it to me"
        onChange={(e) => onChange({ motto: e.target.value })}
        className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
      />
      <span className="mt-1 block text-xs text-muted">Up to 60 characters. Arabic is fine.</span>
    </label>
  )
}

/** Rate yourself: 1-10 on each skill, in the same tap rows as the vote screen. */
export function SkillsField({ skills, onChange }: { skills: Skills; onChange: Change }) {
  return (
    <ul className="space-y-3">
      {SKILLS.map(({ key, label }) => (
        <li key={key}>
          <p className="mb-1.5 flex items-baseline justify-between font-semibold">
            {label} <span className="tabular font-display text-lg">{skills[key] ?? '–'}</span>
          </p>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <ScoreButton
                key={n}
                n={n}
                selected={skills[key] === n}
                onClick={() => onChange({ [key]: n } as Partial<Skills>)}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
