import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FontScaleControl } from './FontScaleControl'

describe('FontScaleControl', () => {
  it('renders three labelled native radio inputs', () => {
    render(<FontScaleControl value={1} onChange={vi.fn()} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((radio) => radio.value)).toEqual(['1', '1.15', '1.35'])
    expect(screen.getByText('Text size')).toBeInTheDocument()
    expect(screen.getByText('Extra Large')).toBeInTheDocument()
  })

  it('reflects the selected scale and reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FontScaleControl value={1} onChange={onChange} />)
    expect(screen.getByLabelText('Normal')).toBeChecked()
    await user.click(screen.getByLabelText('Large'))
    expect(onChange).toHaveBeenCalledWith(1.15)
  })
})
