import { describe, it, expect } from 'vitest'
import { normalizePrompt, validatePrompt, parseFastaSequences } from '../constants'

describe('normalizePrompt', () => {
  it('uppercases and strips whitespace', () => {
    expect(normalizePrompt('  mk ll  ')).toBe('MKLL')
  })
  it('handles empty string', () => {
    expect(normalizePrompt('')).toBe('')
  })
})

describe('validatePrompt', () => {
  it('accepts canonical amino acids', () => {
    expect(validatePrompt('ACDEFGHIKLMNPQRSTVWY', 100)).toBeNull()
  })
  it('rejects B, X, O', () => {
    const err = validatePrompt('ABXO', 100)
    expect(err).toContain('B')
    expect(err).toContain('X')
    expect(err).toContain('O')
    expect(err).toContain('not valid amino acid')
  })
  it('rejects numbers', () => {
    const err = validatePrompt('MK1', 100)
    expect(err).toContain('1')
  })
  it('rejects prompt exceeding max length', () => {
    const err = validatePrompt('MMMM', 3)
    expect(err).toContain('exceeds max length')
  })
  it('returns null for valid short prompt', () => {
    expect(validatePrompt('MK', 512)).toBeNull()
  })
})

describe('parseFastaSequences', () => {
  it('returns empty for empty input', () => {
    const { sequences, errors } = parseFastaSequences('')
    expect(sequences).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('parses comma-separated sequences', () => {
    const { sequences, errors } = parseFastaSequences('MKLL,ACDE,GHIK')
    expect(sequences).toEqual(['MKLL', 'ACDE', 'GHIK'])
    expect(errors).toHaveLength(0)
  })

  it('parses line-separated sequences', () => {
    const { sequences } = parseFastaSequences('MKLL\nACDE\nGHIK')
    expect(sequences).toEqual(['MKLL', 'ACDE', 'GHIK'])
  })

  it('parses FASTA format', () => {
    const fasta = '>seq1\nMKLL\n>seq2\nACDE'
    const { sequences } = parseFastaSequences(fasta)
    expect(sequences).toEqual(['MKLL', 'ACDE'])
  })

  it('reports errors for invalid residues', () => {
    const { sequences, errors } = parseFastaSequences('MKLL,AB1X')
    expect(sequences).toEqual(['MKLL'])
    expect(errors).toHaveLength(1)
    expect(errors[0].index).toBe(2)
    expect(errors[0].message).toContain('not a valid amino acid')
  })

  it('normalizes case and whitespace', () => {
    const { sequences } = parseFastaSequences('mk ll')
    expect(sequences).toEqual(['MKLL'])
  })
})
