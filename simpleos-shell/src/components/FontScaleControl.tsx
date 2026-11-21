import { FONT_SCALES, type FontScale } from '../hooks/useFontScale'

interface FontScaleControlProps {
  value: FontScale
  onChange: (value: FontScale) => void
}

/** Native radio inputs give keyboard and screen-reader support for free. */
export function FontScaleControl({ value, onChange }: FontScaleControlProps) {
  return (
    <fieldset className="font-scale">
      <legend>Text size</legend>
      <div className="font-scale__options">
        {FONT_SCALES.map((option) => (
          <label className="font-scale__option" key={option.value}>
            <input
              type="radio"
              name="font-scale"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
