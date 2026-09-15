import { describe, expect, it } from 'vitest'
import {
  evaluateTeamConstraints,
  generateScrimTeams,
  scoreSkater,
  validateSkaters,
  type Position,
  type Skater,
} from './scrim'

const toPosition = (index: number): Position => {
  if (index % 3 === 0) return 'jammer'
  if (index % 3 === 1) return 'pivot'
  return 'blocker'
}

describe('validateSkaters', () => {
  it('accepts valid rows and rejects invalid values', () => {
    const rows = [
      {
        number: 10,
        name: 'Ava',
        'home league': 'North Star',
        position: 'jammer',
        'years playing': 3,
        'skill level': 2,
      },
      {
        number: -2,
        name: 'Bad',
        'home league': 'X',
        position: 'robot',
        'years playing': 12,
        'skill level': 7,
      },
    ]

    const result = validateSkaters(rows)
    expect(result.valid).toBe(false)
    expect(result.skaters).toHaveLength(1)
    expect(result.issues.some((issue) => issue.field === 'number')).toBe(true)
    expect(result.issues.some((issue) => issue.field === 'position')).toBe(true)
  })
})

describe('generateScrimTeams', () => {
  it('creates two teams with balanced structure', () => {
    const skaters = [
      { number: 1, name: 'A', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 2, name: 'B', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 3, name: 'C', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 0 },
      { number: 4, name: 'D', homeLeague: 'L2', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 5, name: 'E', homeLeague: 'L2', position: 'pivot' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 6, name: 'F', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 7, name: 'G', homeLeague: 'L3', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 8, name: 'H', homeLeague: 'L3', position: 'pivot' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 9, name: 'I', homeLeague: 'L3', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 10, name: 'J', homeLeague: 'L4', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 11, name: 'K', homeLeague: 'L4', position: 'pivot' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 12, name: 'L', homeLeague: 'L4', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 13, name: 'M', homeLeague: 'L5', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 0 },
      { number: 14, name: 'N', homeLeague: 'L5', position: 'pivot' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 15, name: 'O', homeLeague: 'L5', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 16, name: 'P', homeLeague: 'L5', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 17, name: 'Q', homeLeague: 'L5', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 18, name: 'R', homeLeague: 'L5', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
    ]

    const result = generateScrimTeams(
      skaters.map((skater) => ({ ...skater, yearsPlaying: 0, skillLevel: 0 })),
      'rookie',
    )

    expect(result.teamA.length).toBeLessThanOrEqual(15)
    expect(result.teamB.length).toBeLessThanOrEqual(15)
    expect(result.teamA.length + result.teamB.length + result.standby.length).toBeGreaterThanOrEqual(skaters.length)
    expect(result.standby.length).toBeGreaterThanOrEqual(0)
  })

  it('keeps teams as even as possible when fewer than 30 skaters are available', () => {
    const skaters = Array.from({ length: 29 }, (_, index) => ({
      number: index + 1,
      name: `Skater ${index + 1}`,
      homeLeague: 'League',
      position: toPosition(index),
      yearsPlaying: index % 5,
      skillLevel: index % 4,
    }))

    const result = generateScrimTeams(skaters, 'rookie')

    expect(Math.abs(result.teamA.length - result.teamB.length)).toBeLessThanOrEqual(1)
  })

  it('splits extra skaters into evenly sized standby pools and keeps rookie skaters with less experience prioritized', () => {
    const skaters = Array.from({ length: 33 }, (_, index) => ({
      number: index + 1,
      name: `Skater ${index + 1}`,
      homeLeague: 'League',
      position: toPosition(index),
      yearsPlaying: 0,
      skillLevel: index % 2,
    }))

    const result = generateScrimTeams(skaters, 'rookie')

    expect(result.teamA.length).toBe(15)
    expect(result.teamB.length).toBe(15)
    expect(result.standby.length).toBe(3)
    expect(result.standbyA.length).toBe(Math.ceil(result.standby.length / 2))
    expect(result.standbyB.length).toBe(Math.floor(result.standby.length / 2))
    expect(result.teamA.some((skater) => skater.number <= 3)).toBe(true)
  })

  it('keeps standby skaters within each level eligibility range', () => {
    const skaters = Array.from({ length: 36 }, (_, index) => ({
      number: index + 1,
      name: `Skater ${index + 1}`,
      homeLeague: 'League',
      position: toPosition(index),
      yearsPlaying: index % 6,
      skillLevel: index % 6,
    }))

    const rookieResult = generateScrimTeams(skaters, 'rookie')
    const intermediateResult = generateScrimTeams(skaters, 'intermediate')
    const advancedResult = generateScrimTeams(skaters, 'advanced')

    expect(rookieResult.standby.every((skater) => skater.skillLevel <= 3 && skater.yearsPlaying <= 1)).toBe(true)
    expect(intermediateResult.standby.every((skater) => skater.skillLevel >= 1 && skater.skillLevel <= 4)).toBe(true)
    expect(advancedResult.standby.every((skater) => skater.skillLevel >= 3)).toBe(true)
  })

  it('does not select zero-experience skaters for intermediate or advanced games', () => {
    const skaters = Array.from({ length: 40 }, (_, index) => ({
      number: index + 1,
      name: `Skater ${index + 1}`,
      homeLeague: 'League',
      position: toPosition(index),
      yearsPlaying: index < 8 ? 0 : (index % 5) + 1,
      skillLevel: index % 6,
    }))

    const selectedSkaters = (level: 'intermediate' | 'advanced') => {
      const result = generateScrimTeams(skaters, level)
      return [...result.teamA, ...result.teamB, ...result.standby]
    }

    expect(generateScrimTeams(skaters, 'rookie').teamA.every((skater) => skater.yearsPlaying <= 1)).toBe(true)
    expect(generateScrimTeams(skaters, 'rookie').teamB.every((skater) => skater.yearsPlaying <= 1)).toBe(true)
    expect(selectedSkaters('intermediate').every((skater) => skater.yearsPlaying > 0 && skater.yearsPlaying < 5)).toBe(true)
    expect(selectedSkaters('advanced').every((skater) => skater.yearsPlaying > 0)).toBe(true)
  })

  it('prioritises rookie experience zero with skill zero or one before other eligible rookies', () => {
    const skaters = [
      { number: 1, name: 'Experience 1 skill 1', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 2, name: 'Experience 0 skill 3', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 0, skillLevel: 3 },
      { number: 3, name: 'Experience 0 skill 1', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 0, skillLevel: 1 },
    ]

    expect(scoreSkater(skaters[2], 'rookie')).toBeGreaterThan(scoreSkater(skaters[0], 'rookie'))
    expect(scoreSkater(skaters[0], 'rookie')).toBeGreaterThan(scoreSkater(skaters[1], 'rookie'))
  })

  it('prioritises skaters by scrim level: rookie less experience, intermediate middle range, advanced high skill and experience', () => {
    const skaters = [
      { number: 1, name: 'Rookie low', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 0, skillLevel: 0 },
      { number: 2, name: 'Rookie high', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 3, name: 'Intermediate mid', homeLeague: 'L2', position: 'pivot' as const, yearsPlaying: 3, skillLevel: 2 },
      { number: 4, name: 'Intermediate high', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 5, name: 'Advanced high', homeLeague: 'L3', position: 'jammer' as const, yearsPlaying: 6, skillLevel: 5 },
      { number: 6, name: 'Advanced low', homeLeague: 'L3', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
    ]

    const rookieScores = Object.fromEntries(
      skaters.map((skater) => [skater.name, scoreSkater(skater, 'rookie')]),
    )
    const intermediateScores = Object.fromEntries(
      skaters.map((skater) => [skater.name, scoreSkater(skater, 'intermediate')]),
    )
    const advancedScores = Object.fromEntries(
      skaters.map((skater) => [skater.name, scoreSkater(skater, 'advanced')]),
    )

    expect(rookieScores['Rookie low']).toBeGreaterThan(rookieScores['Rookie high'])
    expect(intermediateScores['Intermediate mid']).toBeGreaterThan(intermediateScores['Intermediate high'])
    expect(advancedScores['Advanced high']).toBeGreaterThan(advancedScores['Advanced low'])
  })

  it('keeps the skill difference between teams within a tight range', () => {
    const skaters = [
      { number: 1, name: 'Low 1', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 0, skillLevel: 1 },
      { number: 2, name: 'Low 2', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 0, skillLevel: 1 },
      { number: 3, name: 'Low 3', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 0, skillLevel: 1 },
      { number: 4, name: 'Low 4', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 5, name: 'Low 5', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 6, name: 'Low 6', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 7, name: 'Low 7', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 8, name: 'Low 8', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 1, skillLevel: 1 },
      { number: 9, name: 'High 1', homeLeague: 'L2', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 10, name: 'High 2', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 11, name: 'High 3', homeLeague: 'L2', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 12, name: 'High 4', homeLeague: 'L2', position: 'jammer' as const, yearsPlaying: 4, skillLevel: 5 },
      { number: 13, name: 'High 5', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 4, skillLevel: 5 },
      { number: 14, name: 'High 6', homeLeague: 'L2', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 15, name: 'High 7', homeLeague: 'L2', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 16, name: 'High 8', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 4, skillLevel: 5 },
      { number: 17, name: 'Random 1', homeLeague: 'L3', position: 'jammer' as const, yearsPlaying: 2, skillLevel: 3 },
      { number: 18, name: 'Random 2', homeLeague: 'L3', position: 'blocker' as const, yearsPlaying: 3, skillLevel: 2 },
    ]

    const result = generateScrimTeams(skaters, 'advanced')
    const skillDelta = Math.abs(result.summary.teamASkill - result.summary.teamBSkill)
    expect(skillDelta).toBeLessThanOrEqual(10)
  })

  it('keeps jammer totals to 3-5 per team and sends extras to standby', () => {
    const skaters = Array.from({ length: 40 }, (_, index) => ({
      number: index + 1,
      name: `Skater ${index + 1}`,
      homeLeague: 'League',
      position: (index < 12 ? 'jammer' : index % 3 === 0 ? 'pivot' : 'blocker') as Position,
      yearsPlaying: index % 5,
      skillLevel: index % 4,
    }))

    const result = generateScrimTeams(skaters, 'advanced')

    expect(result.teamA.filter((skater) => skater.position === 'jammer').length).toBeLessThanOrEqual(5)
    expect(result.teamB.filter((skater) => skater.position === 'jammer').length).toBeLessThanOrEqual(5)
    expect(result.standby.filter((skater) => skater.position === 'jammer').length).toBeGreaterThanOrEqual(0)
  })

  it('counts pivots toward the blocker minimum when they are acting as blockers', () => {
    const teamA = [
      { number: 1, name: 'A', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 2, name: 'B', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 3, name: 'C', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 4, name: 'D', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 5, name: 'E', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 6, name: 'F', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 7, name: 'G', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 8, name: 'H', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 9, name: 'I', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 10, name: 'J', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 11, name: 'K', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 12, name: 'L', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 13, name: 'M', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 14, name: 'N', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 15, name: 'O', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
    ]

    const teamB: Skater[] = Array.from({ length: 15 }, (_, index) => ({
      number: index + 16,
      name: `Player ${index + 16}`,
      homeLeague: 'L2',
      position: (index % 3 === 0 ? 'jammer' : index % 3 === 1 ? 'pivot' : 'blocker') as Position,
      yearsPlaying: 5,
      skillLevel: 5,
    }))

    const report = evaluateTeamConstraints(teamA, teamB)
    expect(report.valid).toBe(true)
    expect(report.failures.some((failure) => failure.includes('blockers'))).toBe(false)
  })

  it('reports which constraint has failed when the roster does not meet the scrim rules', () => {
    const teamA = [
      { number: 1, name: 'A', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 2, name: 'B', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 3, name: 'C', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 4, name: 'D', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 5, name: 'E', homeLeague: 'L1', position: 'jammer' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 6, name: 'F', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 7, name: 'G', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 8, name: 'H', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 9, name: 'I', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 10, name: 'J', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 11, name: 'K', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 12, name: 'L', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 13, name: 'M', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 14, name: 'N', homeLeague: 'L1', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 15, name: 'O', homeLeague: 'L1', position: 'pivot' as const, yearsPlaying: 5, skillLevel: 5 },
    ]

    const teamB = [
      { number: 16, name: 'P', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 17, name: 'Q', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 18, name: 'R', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 19, name: 'S', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 20, name: 'T', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 21, name: 'U', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 22, name: 'V', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 23, name: 'W', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 24, name: 'X', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 25, name: 'Y', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 26, name: 'Z', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 27, name: 'AA', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 28, name: 'AB', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 29, name: 'AC', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
      { number: 30, name: 'AD', homeLeague: 'L2', position: 'blocker' as const, yearsPlaying: 5, skillLevel: 5 },
    ]

    const report = evaluateTeamConstraints(teamA, teamB)
    expect(report.valid).toBe(false)
    expect(report.failures.some((failure) => failure.includes('jammers'))).toBe(true)
  })
})
