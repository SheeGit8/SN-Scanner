import { describe, it, expect } from 'vitest'
import { extractSerial, extractField, createRepeatGate } from './ocr.js'

describe('extractSerial', () => {
  it.each([
    ['Sn: 12222', '12222'],
    ['S/N: 5CG1234XYZ', '5CG1234XYZ'],
    ['SN#ABC-123', 'ABC-123'],
    ['S.N. 998877', '998877'],
    ['S N 443322', '443322'],
    ['Serial No: pf2abc12', 'PF2ABC12'],
    ['Serial Number - XJ-44-01', 'XJ-44-01'],
    ['S/N: 12222 Model: X', '12222'],
    ['5/N: 777888', '777888'],
    ['S|N 445566', '445566'],
    ['SIN: 123456', '123456'],
    ['S/N:\n12222', '12222'],
    ['S/N: 12222.', '12222'],
    ['Dell Inc\nModel: P99G\nS/N: 7HX2Q83', '7HX2Q83'],
    ['Serial: 55443', '55443'],
  ])('%j -> %s', (text, expected) => expect(extractSerial(text)).toBe(expected))

  it.each([['VERSION 2'], ['S/N: A1'], ['no serial here'], ['']])('%j -> null', (text) =>
    expect(extractSerial(text)).toBeNull())
})

describe('extractSerial: "S/N NO." labels and boxed serials (real OCR output)', () => {
  it.each([
    // As printed on a Redragon keyboard label.
    ['S/N NO.: RDK686WB-RGB-PRO26041900883', 'RDK686WB-RGB-PRO26041900883'],
    // Tesseract output from that label: junk before the prefix, no colon.
    ['PES S/N NO. ROKE86WB-RGB-PRO26041900883', 'ROKE86WB-RGB-PRO26041900883'],
    // The box printed around the serial, read as a bracket or a bar.
    ['S/N NO.: [RDK686WB-RGB-PRO26041900883]', 'RDK686WB-RGB-PRO26041900883'],
    ['S/N NO.: |RDK686WB-RGB-PRO26041900883 |', 'RDK686WB-RGB-PRO26041900883'],
    // Prefix parts run together, then the box edge.
    [': + SNNO.| ROK685WB-RGB-PRO26041900883 >', 'ROK685WB-RGB-PRO26041900883'],
    ['S/NNO.: RDKE85WB-RGB-PRO26041900883', 'RDKE85WB-RGB-PRO26041900883'],
    // Zero read for the O; semicolon read for the colon.
    ['S/N N0.: 7HX2Q83', '7HX2Q83'],
    ['| SNNO.; | ROKE85WB-RGB-PRO26041900883', 'ROKE85WB-RGB-PRO26041900883'],
    // The box's right edge read as a colon: a code with digits is still a serial, not a label.
    ['PY S/N NO. ROKE86WB-RGB-PRO26041900883 :', 'ROKE86WB-RGB-PRO26041900883'],
    // A serial that itself starts with "NO" keeps it.
    ['S/N NO12345', 'NO12345'],
    ['S/N: NO12345', 'NO12345'],
  ])('%j -> %s', (text, expected) => expect(extractSerial(text)).toBe(expected))

  it('finds the serial in the full text read from the label', () => {
    const text = [
      '3-MODES 98 KEY GASKET HOT-SWAPPABLE RGB ME',
      'MODEL: K686WB-RGB-PRO HVIN: K686WB-RGB-PRO',
      'REDRAGON RATING: 5V===500mA / 3.7V===120mA |',
      'PES S/N NO. ROKE86WB-RGB-PRO26041900883',
      'EISA PRO Warning: EY — Z',
    ].join('\n')
    expect(extractSerial(text)).toBe('ROKE86WB-RGB-PRO26041900883')
  })
})

describe('extractField', () => {
  it('reads model', () => expect(extractField('Model: Latitude 5420\nS/N: 1', ['model'])).toBe('Latitude 5420'))
  it('stops at next label', () => expect(extractField('Model: P99G Color: Black', ['model'])).toBe('P99G'))
  it('accepts alternates', () => expect(extractField('Colour: Silver', ['color', 'colour'])).toBe('Silver'))
  it('missing -> null', () => expect(extractField('S/N: 12222', ['model'])).toBeNull())
})

describe('line-break and layout handling (review fixes)', () => {
  it.each([['USB 5\nN 1234'], ['5\nN 12345'], ['S/N:\nModel: X1\n12222']])('%j -> no wrong serial', (text) =>
    expect(extractSerial(text)).toBeNull())
  it('model value is not taken from the next line', () =>
    expect(extractField('Model:\nS/N: 12222', ['model'])).toBeNull())
  it('model value stops at a serial prefix', () =>
    expect(extractField('Model: P99G SN 12345', ['model'])).toBe('P99G'))
})

describe('createRepeatGate', () => {
  it('accepts a new serial', () => expect(createRepeatGate().accept('A1B2')).toBe(true))
  it('ignores the held serial while it stays in view, however long', () => {
    const gate = createRepeatGate(2)
    gate.hold('A1B2')
    for (let i = 0; i < 10; i++) expect(gate.accept('A1B2')).toBe(false)
  })
  it('re-arms after the held serial is missing from 2 frames in a row', () => {
    const gate = createRepeatGate(2)
    gate.hold('A1B2')
    gate.accept(null)
    expect(gate.accept('A1B2')).toBe(false)
    gate.accept(null)
    gate.accept(null)
    expect(gate.accept('A1B2')).toBe(true)
  })
  it('null is never accepted', () => expect(createRepeatGate().accept(null)).toBe(false))
})
