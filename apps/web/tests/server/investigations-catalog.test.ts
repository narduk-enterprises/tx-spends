import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INVESTIGATION_TOPICS,
  INVESTIGATION_TOPIC_DIFFICULTIES,
  INVESTIGATION_TOPIC_IMPACTS,
} from '../../server/utils/investigations/defaultTopics'

describe('DEFAULT_INVESTIGATION_TOPICS', () => {
  it('contains exactly 20 seeded topics', () => {
    expect(DEFAULT_INVESTIGATION_TOPICS).toHaveLength(20)
  })

  it('uses unique slugs', () => {
    const slugs = DEFAULT_INVESTIGATION_TOPICS.map((topic) => topic.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('uses unique priority ranks from 1 through 20', () => {
    const ranks = DEFAULT_INVESTIGATION_TOPICS.map((topic) => topic.priorityRank).sort(
      (left, right) => left - right,
    )

    expect(ranks).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
  })

  it('uses only allowed impact and difficulty values', () => {
    for (const topic of DEFAULT_INVESTIGATION_TOPICS) {
      expect(INVESTIGATION_TOPIC_IMPACTS).toContain(topic.impact)
      expect(INVESTIGATION_TOPIC_DIFFICULTIES).toContain(topic.difficulty)
    }
  })

  it('includes all required structured dossier fields', () => {
    for (const topic of DEFAULT_INVESTIGATION_TOPICS) {
      expect(topic.title.length).toBeGreaterThan(0)
      expect(topic.lane.length).toBeGreaterThan(0)
      expect(topic.flaggedPattern.length).toBeGreaterThan(0)
      expect(topic.summary.length).toBeGreaterThan(0)
      expect(topic.investigativeQuestion.length).toBeGreaterThan(0)
      expect(topic.publicImpact.length).toBeGreaterThan(0)
      expect(topic.notes.length).toBeGreaterThan(0)
      expect(topic.sourceReferences.length).toBeGreaterThan(0)
      expect(topic.recordsToObtain.length).toBeGreaterThan(0)
      expect(topic.reportingSteps.length).toBeGreaterThan(0)
      expect(topic.visualIdeas.length).toBeGreaterThan(0)
    }
  })
})
