import { describe, expect, it } from 'vitest'
import { DEFAULT_INVESTIGATION_TOPICS } from '../../server/utils/investigations/defaultTopics'
import {
  getSeedableInvestigationTopics,
  serializeInvestigationTopicUpdate,
  sortInvestigationTopicsForAdmin,
} from '../../server/utils/investigations/pure'

describe('getSeedableInvestigationTopics', () => {
  it('returns only topics whose slugs are missing', () => {
    const existing = [
      DEFAULT_INVESTIGATION_TOPICS[0]!.slug,
      DEFAULT_INVESTIGATION_TOPICS[3]!.slug,
      DEFAULT_INVESTIGATION_TOPICS[8]!.slug,
    ]

    const missing = getSeedableInvestigationTopics(existing)

    expect(missing).toHaveLength(DEFAULT_INVESTIGATION_TOPICS.length - existing.length)
    expect(missing.some((topic) => existing.includes(topic.slug))).toBe(false)
  })

  it('becomes idempotent once all defaults are considered present', () => {
    const seeded = getSeedableInvestigationTopics([])
    const secondPass = getSeedableInvestigationTopics(seeded.map((topic) => topic.slug))

    expect(seeded).toHaveLength(DEFAULT_INVESTIGATION_TOPICS.length)
    expect(secondPass).toEqual([])
  })
})

describe('sortInvestigationTopicsForAdmin', () => {
  it('sorts by ascending priority and then descending updated time', () => {
    const sorted = sortInvestigationTopicsForAdmin([
      { id: 'c', priorityRank: 4, updatedAt: '2026-03-20T00:00:00.000Z' },
      { id: 'b', priorityRank: 2, updatedAt: '2026-03-19T00:00:00.000Z' },
      { id: 'a', priorityRank: 2, updatedAt: '2026-03-21T00:00:00.000Z' },
    ])

    expect(sorted.map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('serializeInvestigationTopicUpdate', () => {
  it('preserves updated status and notes while trimming list fields', () => {
    const serialized = serializeInvestigationTopicUpdate({
      slug: '  sample-topic  ',
      title: '  Sample Topic  ',
      priorityRank: 7,
      status: 'reporting',
      lane: '  Water finance  ',
      flaggedPattern: '  New large payee  ',
      impact: 'high',
      difficulty: 'medium_high',
      summary: '  Summary  ',
      investigativeQuestion: '  Question  ',
      publicImpact: '  Public impact  ',
      notes: '  Keep pushing for the bond documents.  ',
      sourceReferences: [
        { label: '  TWDB board packets ', note: '  Use for approvals ', url: '' },
        { label: ' ', note: ' ', url: '' },
      ],
      recordsToObtain: ['  Board resolution  ', '   '],
      reportingSteps: ['  Call TWDB  ', ''],
      visualIdeas: ['  Series timeline  ', '   '],
    })

    expect(serialized.status).toBe('reporting')
    expect(serialized.notes).toBe('Keep pushing for the bond documents.')
    expect(serialized.sourceReferences).toEqual([
      { label: 'TWDB board packets', note: 'Use for approvals', url: null },
    ])
    expect(serialized.recordsToObtain).toEqual(['Board resolution'])
    expect(serialized.reportingSteps).toEqual(['Call TWDB'])
    expect(serialized.visualIdeas).toEqual(['Series timeline'])
  })
})
