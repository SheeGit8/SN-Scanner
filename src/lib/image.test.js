import { describe, expect, it } from 'vitest'
import { fitWithin, visibleRect } from './image.js'

describe('visibleRect', () => {
  it('crops the sides of a wide video in a tall box', () => {
    // 1920x1080 shown in a 400x500 box: scale = 500/1080, visible width = 400/scale = 864.
    const r = visibleRect(1920, 1080, 400, 500)
    expect(r.sh).toBeCloseTo(1080)
    expect(r.sy).toBeCloseTo(0)
    expect(r.sw).toBeCloseTo(864)
    expect(r.sx).toBeCloseTo((1920 - 864) / 2)
  })

  it('crops the top and bottom of a tall video in a wide box', () => {
    const r = visibleRect(1080, 1920, 800, 450)
    expect(r.sw).toBeCloseTo(1080)
    expect(r.sx).toBeCloseTo(0)
    expect(r.sh).toBeCloseTo(607.5)
    expect(r.sy).toBeCloseTo((1920 - 607.5) / 2)
  })

  it('keeps the whole frame when the shapes match', () => {
    expect(visibleRect(1600, 1200, 400, 300)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 1200 })
  })
})

describe('fitWithin', () => {
  it('scales the long side down to the cap', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('never scales up', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('rounds to whole pixels and never returns 0', () => {
    expect(fitWithin(864.4, 1080, 1600)).toEqual({ width: 864, height: 1080 })
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 })
  })
})
