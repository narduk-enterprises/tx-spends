import { describe, expect, it } from 'vitest'
import { updateInvestigationTopicBodySchema } from '../../server/utils/investigations/validation'

const validPayload = {
  slug: 'sample-investigation-topic',
  title: 'Sample Investigation Topic',
  priorityRank: 4,
  status: 'backlog',
  lane: 'Water finance',
  flaggedPattern: 'New large payee',
  impact: 'high',
  difficulty: 'medium_high',
  summary: 'A concise summary.',
  investigativeQuestion: 'What explains the payment pattern?',
  publicImpact: 'Readers would understand the financing structure.',
  notes: 'Keep the framing explanatory.',
  sourceReferences: [
    {
      label: 'TWDB board packets',
      note: 'Use the approvals and supporting schedules.',
      url: null,
    },
  ],
  recordsToObtain: ['Board packet attachments'],
  reportingSteps: ['Match payments to board approvals'],
  visualIdeas: ['Series-by-series timeline'],
} as const

describe('updateInvestigationTopicBodySchema', () => {
  it('accepts a valid dossier update payload', () => {
    expect(updateInvestigationTopicBodySchema.parse(validPayload)).toEqual(validPayload)
  })

  it('rejects invalid status values', () => {
    expect(() =>
      updateInvestigationTopicBodySchema.parse({
        ...validPayload,
        status: 'review',
      }),
    ).toThrow()
  })

  it('rejects invalid impact and difficulty values', () => {
    expect(() =>
      updateInvestigationTopicBodySchema.parse({
        ...validPayload,
        impact: 'critical',
      }),
    ).toThrow()

    expect(() =>
      updateInvestigationTopicBodySchema.parse({
        ...validPayload,
        difficulty: 'very_high',
      }),
    ).toThrow()
  })

  it('rejects malformed source references', () => {
    expect(() =>
      updateInvestigationTopicBodySchema.parse({
        ...validPayload,
        sourceReferences: [{ label: '', note: 'Missing label', url: null }],
      }),
    ).toThrow()

    expect(() =>
      updateInvestigationTopicBodySchema.parse({
        ...validPayload,
        sourceReferences: [{ label: 'Packets', note: 'Bad URL', url: 'notaurl' }],
      }),
    ).toThrow()
  })
})
