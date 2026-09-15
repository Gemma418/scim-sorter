export type Position = 'jammer' | 'pivot' | 'blocker'
export type ScrimLevel = 'rookie' | 'intermediate' | 'advanced'

export type Skater = {
  number: number
  name: string
  homeLeague: string
  position: Position
  yearsPlaying: number
  skillLevel: number
}

export type ValidationIssue = {
  index: number
  field: string
  message: string
}

export type ValidationResult = {
  valid: boolean
  skaters: Skater[]
  issues: ValidationIssue[]
}

export type TeamResult = {
  teamA: Skater[]
  teamB: Skater[]
  standby: Skater[]
  standbyA: Skater[]
  standbyB: Skater[]
  summary: {
    teamASkill: number
    teamBSkill: number
    teamAExperience: number
    teamBExperience: number
    teamAJammers: number
    teamBJammers: number
    teamAPivots: number
    teamBPivots: number
    standbyCount: number
    standbyACount: number
    standbyBCount: number
  }
}

export type ConstraintReport = {
  valid: boolean
  failures: string[]
}

const validPositions = new Set<Position>(['jammer', 'pivot', 'blocker'])

const normalizedPosition = (value: unknown): Position | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return validPositions.has(normalized as Position) ? (normalized as Position) : null
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export const validateSkaters = (rows: unknown[]): ValidationResult => {
  const issues: ValidationIssue[] = []
  const skaters: Skater[] = []

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      issues.push({ index, field: 'row', message: 'Row must be an object.' })
      return
    }

    const record = row as Record<string, unknown>
    const number = toNumber(record.number)
    const name = normalizeString(record.name)
    const homeLeague = normalizeString(record['home league'] ?? record.homeLeague)
    const position = normalizedPosition(record.position)
    const yearsPlaying = toNumber(record['years playing'] ?? record.experience ?? record.yearsPlaying)
    const skillLevel = toNumber(record['skill level'] ?? record.skill ?? record.skillLevel)

    if (number === null || number < 0 || number > 1000000) {
      issues.push({ index, field: 'number', message: 'Number must be between 0 and 1000000.' })
    }

    if (!name) {
      issues.push({ index, field: 'name', message: 'Name is required.' })
    }

    if (!homeLeague) {
      issues.push({ index, field: 'homeLeague', message: 'Home league is required.' })
    }

    if (!position) {
      issues.push({ index, field: 'position', message: 'Position must be jammer, pivot or blocker.' })
    }

    if (yearsPlaying === null || yearsPlaying < 0 || yearsPlaying > 10) {
      issues.push({ index, field: 'yearsPlaying', message: 'Years playing must be between 0 and 10.' })
    }

    if (skillLevel === null || skillLevel < 0 || skillLevel > 5) {
      issues.push({ index, field: 'skillLevel', message: 'Skill level must be between 0 and 5.' })
    }

    if (
      number !== null &&
      name &&
      homeLeague &&
      position &&
      yearsPlaying !== null &&
      skillLevel !== null
    ) {
      skaters.push({
        number,
        name,
        homeLeague,
        position,
        yearsPlaying,
        skillLevel,
      })
    }
  })

  return { valid: issues.length === 0, skaters, issues }
}

export const scoreSkater = (skater: Skater, level: ScrimLevel) => {
  const roleBias =
    skater.position === 'pivot' ? 2 : skater.position === 'jammer' ? 3 : 1

  if (level === 'rookie') {
    const preferredSkill = skater.skillLevel <= 1
    const priority =
      skater.yearsPlaying === 0 && preferredSkill
        ? 100
        : skater.yearsPlaying === 1 && preferredSkill
          ? 90
          : skater.yearsPlaying === 0
            ? 80
            : 70
    return priority + (6 - skater.skillLevel) + roleBias
  }

  if (level === 'intermediate') {
    const experiencePriority = skater.yearsPlaying === 2 || skater.yearsPlaying === 3 ? 30 : skater.yearsPlaying === 1 || skater.yearsPlaying === 4 ? 20 : 0
    const skillPriority = skater.skillLevel === 2 || skater.skillLevel === 3 ? 30 : skater.skillLevel === 1 || skater.skillLevel === 4 ? 20 : 0
    return experiencePriority + skillPriority - Math.abs(skater.yearsPlaying - 2.5) - Math.abs(skater.skillLevel - 2.5) + roleBias
  }

  if (level === 'advanced') {
    const experiencePriority = skater.yearsPlaying === 5 ? 30 : skater.yearsPlaying === 4 ? 20 : 0
    const skillPriority = skater.skillLevel === 5 ? 30 : skater.skillLevel === 4 ? 20 : 0
    return experiencePriority + skillPriority + skater.yearsPlaying + skater.skillLevel + roleBias
  }

  return roleBias
}

const getTeamSizes = (count: number) => {
  if (count >= 30) return { teamA: 15, teamB: 15, standby: count - 30 }
  if (count === 0) return { teamA: 0, teamB: 0, standby: 0 }
  const upper = Math.ceil(count / 2)
  const lower = Math.floor(count / 2)
  return {
    teamA: upper,
    teamB: lower,
    standby: 0,
  }
}

const sortByPriority = (skaters: Skater[], level: ScrimLevel) =>
  [...skaters].sort((a, b) => {
    const skillDiff = scoreSkater(b, level) - scoreSkater(a, level)
    if (skillDiff !== 0) return skillDiff
    return b.skillLevel - a.skillLevel || b.yearsPlaying - a.yearsPlaying || a.number - b.number
  })

const isEligibleForStandby = (skater: Skater, level: ScrimLevel) => {
  if (level === 'rookie') return skater.skillLevel <= 3 && skater.yearsPlaying <= 1
  if (level === 'intermediate') {
    return skater.skillLevel >= 1 && skater.skillLevel <= 4 && skater.yearsPlaying >= 1 && skater.yearsPlaying <= 3
  }
  return skater.yearsPlaying >= 4 && skater.yearsPlaying <= 5 && (skater.skillLevel >= 4 || (skater.skillLevel === 3 && skater.yearsPlaying === 5))
}

const isEligibleForGame = (skater: Skater, level: ScrimLevel) =>
  level === 'rookie'
    ? skater.skillLevel <= 3 && skater.yearsPlaying <= 1
    : level === 'intermediate'
      ? skater.skillLevel >= 1 && skater.skillLevel <= 4 && skater.yearsPlaying >= 1 && skater.yearsPlaying <= 3
      : skater.yearsPlaying >= 4 && skater.yearsPlaying <= 5 && (skater.skillLevel >= 4 || (skater.skillLevel === 3 && skater.yearsPlaying === 5))

const getEffectiveRole = (position: Position): 'jammer' | 'blocker' =>
  position === 'jammer' ? 'jammer' : 'blocker'

const getTeamSkillTotal = (team: Skater[]) =>
  team.reduce((sum, skater) => sum + skater.skillLevel, 0)

const getRoleCount = (team: Skater[], position: Skater['position']) =>
  team.filter((skater) => skater.position === position).length

const buildBalancedTeams = (available: Skater[], teamSizes: { teamA: number; teamB: number }, level: ScrimLevel) => {
  const ranked = sortByPriority(available, level)
  const teamA: Skater[] = []
  const teamB: Skater[] = []
  const assigned = new Set<number>()

  const chooseTeam = (skater: Skater) => {
    const aSkill = getTeamSkillTotal(teamA) + skater.skillLevel
    const bSkill = getTeamSkillTotal(teamB) + skater.skillLevel
    const aDelta = Math.abs(aSkill - bSkill)
    const bDelta = Math.abs(bSkill - aSkill)

    const aRoleCount = getRoleCount(teamA, skater.position)
    const bRoleCount = getRoleCount(teamB, skater.position)

    if (teamA.length >= teamSizes.teamA) return 'B'
    if (teamB.length >= teamSizes.teamB) return 'A'

    if (aDelta !== bDelta) {
      return aDelta <= bDelta ? 'A' : 'B'
    }

    if (aRoleCount !== bRoleCount) {
      return aRoleCount <= bRoleCount ? 'A' : 'B'
    }

    if (teamA.length !== teamB.length) {
      return teamA.length < teamB.length ? 'A' : 'B'
    }

    return getTeamSkillTotal(teamA) <= getTeamSkillTotal(teamB) ? 'A' : 'B'
  }

  ranked.forEach((skater) => {
    if (assigned.has(skater.number)) return
    const target = chooseTeam(skater)
    if (target === 'A') {
      if (teamA.length < teamSizes.teamA) {
        teamA.push(skater)
        assigned.add(skater.number)
      }
    } else if (teamB.length < teamSizes.teamB) {
      teamB.push(skater)
      assigned.add(skater.number)
    }
  })

  const remaining = ranked.filter((skater) => !assigned.has(skater.number))
  remaining.forEach((skater) => {
    if (teamA.length < teamSizes.teamA) {
      teamA.push(skater)
      assigned.add(skater.number)
      return
    }
    if (teamB.length < teamSizes.teamB) {
      teamB.push(skater)
      assigned.add(skater.number)
    }
  })

  return { teamA, teamB }
}

const splitStandby = (standby: Skater[], level: ScrimLevel) => {
  const sorted = sortByPriority(standby, level)
  const teamA: Skater[] = []
  const teamB: Skater[] = []

  if (sorted.length <= 5) {
    return {
      teamA: sorted.filter((_, index) => index % 2 === 0),
      teamB: sorted.filter((_, index) => index % 2 !== 0),
    }
  }

  const ensureCoverage = (target: Skater[], role: Skater['position']) => {
    const next = sorted.find(
      (skater) =>
        skater.position === role &&
        !target.some((member) => member.number === skater.number) &&
        !teamA.some((member) => member.number === skater.number) &&
        !teamB.some((member) => member.number === skater.number),
    )

    if (next) {
      target.push(next)
    }
  }

  ensureCoverage(teamA, 'jammer')
  ensureCoverage(teamB, 'pivot')
  ensureCoverage(teamA, 'blocker')

  const remaining = sorted.filter(
    (skater) =>
      !teamA.some((member) => member.number === skater.number) &&
      !teamB.some((member) => member.number === skater.number),
  )

  remaining.forEach((skater, index) => {
    if (index % 2 === 0) {
      teamA.push(skater)
    } else {
      teamB.push(skater)
    }
  })

  return { teamA, teamB }
}

const splitByTeam = (skaters: Skater[], level: ScrimLevel): TeamResult => {
  if (skaters.length === 0) {
    return {
      teamA: [],
      teamB: [],
      standby: [],
      standbyA: [],
      standbyB: [],
      summary: {
        teamASkill: 0,
        teamBSkill: 0,
        teamAExperience: 0,
        teamBExperience: 0,
        teamAJammers: 0,
        teamBJammers: 0,
        teamAPivots: 0,
        teamBPivots: 0,
        standbyCount: 0,
        standbyACount: 0,
        standbyBCount: 0,
      },
    }
  }

  const sorted = sortByPriority(skaters, level)
  const activeTarget = Math.min(sorted.length, 30)
  const activePool = sorted.slice(0, activeTarget)
  const standbyPool = sorted.slice(activeTarget)

  const teamSizes = getTeamSizes(sorted.length)
  let { teamA, teamB } = buildBalancedTeams(activePool, teamSizes, level)
  const standbyReserve: Skater[] = []

  const fillMissingPlayers = (team: Skater[], targetSize: number, otherTeam: Skater[]) => {
    const remaining = activePool.filter(
      (skater) =>
        !team.some((member) => member.number === skater.number) &&
        !otherTeam.some((member) => member.number === skater.number) &&
        !standbyReserve.some((member) => member.number === skater.number),
    )

    while (team.length < targetSize) {
      const next = sortByPriority(
        remaining.filter(
          (skater) =>
            !(team.filter((member) => member.position === 'jammer').length >= 5 && skater.position === 'jammer'),
        ),
        level,
      )[0]

      if (!next) break

      team.push(next)
      const index = remaining.findIndex((skater) => skater.number === next.number)
      if (index >= 0) {
        remaining.splice(index, 1)
      }
    }
  }

  fillMissingPlayers(teamA, teamSizes.teamA, teamB)
  fillMissingPlayers(teamB, teamSizes.teamB, teamA)

  const ensureMinimumJammers = (team: Skater[], otherTeam: Skater[]) => {
    while (team.filter((skater) => skater.position === 'jammer').length < 3) {
      const nonJammer = [...team.filter((skater) => skater.position !== 'jammer')].sort(
        (a, b) => a.skillLevel - b.skillLevel,
      )[0]
      if (!nonJammer) break

      const teamSkill = team.reduce((sum, skater) => sum + skater.skillLevel, 0) / team.length
      const standbyJammer = [...standbyPool.filter((skater) => skater.position === 'jammer')].sort(
        (a, b) => Math.abs(a.skillLevel - teamSkill) - Math.abs(b.skillLevel - teamSkill),
      )[0]
      const otherTeamJammer =
        otherTeam.filter((skater) => skater.position === 'jammer').length > 3
          ? [...otherTeam.filter((skater) => skater.position === 'jammer')].sort(
              (a, b) => Math.abs(a.skillLevel - nonJammer.skillLevel) - Math.abs(b.skillLevel - nonJammer.skillLevel),
            )[0]
          : undefined
      const candidate = standbyJammer ?? otherTeamJammer
      if (!candidate) break

      const teamIndex = team.findIndex((skater) => skater.number === nonJammer.number)
      if (teamIndex < 0) break
      team[teamIndex] = candidate

      if (candidate === standbyJammer) {
        standbyPool.splice(standbyPool.findIndex((skater) => skater.number === candidate.number), 1)
        standbyPool.push(nonJammer)
      } else {
        const otherIndex = otherTeam.findIndex((skater) => skater.number === candidate.number)
        if (otherIndex >= 0) otherTeam[otherIndex] = nonJammer
      }
    }
  }

  ensureMinimumJammers(teamA, teamB)
  ensureMinimumJammers(teamB, teamA)

  const capTeamJammers = (team: Skater[]) => {
    while (team.filter((skater) => skater.position === 'jammer').length > 5) {
      const weakestJammer = [...team.filter((skater) => skater.position === 'jammer')].sort(
        (a, b) => scoreSkater(a, level) - scoreSkater(b, level),
      )[0]

      if (!weakestJammer) break

      const teamIndex = team.findIndex((member) => member.number === weakestJammer.number)
      if (teamIndex >= 0) {
        team.splice(teamIndex, 1)
        standbyReserve.push(weakestJammer)
      }

      const replacement = sortByPriority(
        standbyPool.filter((skater) => skater.position !== 'jammer'),
        level,
      )[0]

      if (replacement) {
        team.push(replacement)
        const replacementIndex = standbyPool.findIndex((skater) => skater.number === replacement.number)
        if (replacementIndex >= 0) {
          standbyPool.splice(replacementIndex, 1)
        }
      }
    }
  }

  capTeamJammers(teamA)
  capTeamJammers(teamB)

  const finalReservedNumbers = new Set(standbyReserve.map((skater) => skater.number))
  const remainingUnassigned = activePool.filter(
    (skater) =>
      !teamA.some((member) => member.number === skater.number) &&
      !teamB.some((member) => member.number === skater.number) &&
      !finalReservedNumbers.has(skater.number),
  )

  const finalStandby = [...standbyPool, ...standbyReserve, ...remainingUnassigned].filter(
    (skater) => isEligibleForStandby(skater, level),
  )
  const standbyDistribution = splitStandby(finalStandby, level)
  const standbyA = standbyDistribution.teamA
  const standbyB = standbyDistribution.teamB
  const combinedStandby = [...standbyA, ...standbyB]

  const teamASkill = teamA.reduce((sum, skater) => sum + skater.skillLevel, 0)
  const teamBSkill = teamB.reduce((sum, skater) => sum + skater.skillLevel, 0)
  const teamAExperience = teamA.reduce((sum, skater) => sum + skater.yearsPlaying, 0)
  const teamBExperience = teamB.reduce((sum, skater) => sum + skater.yearsPlaying, 0)

  return {
    teamA,
    teamB,
    standby: combinedStandby,
    standbyA,
    standbyB,
    summary: {
      teamASkill,
      teamBSkill,
      teamAExperience,
      teamBExperience,
      teamAJammers: teamA.filter((skater) => skater.position === 'jammer').length,
      teamBJammers: teamB.filter((skater) => skater.position === 'jammer').length,
      teamAPivots: teamA.filter((skater) => skater.position === 'pivot').length,
      teamBPivots: teamB.filter((skater) => skater.position === 'pivot').length,
      standbyCount: combinedStandby.length,
      standbyACount: standbyA.length,
      standbyBCount: standbyB.length,
    },
  }
}

export const evaluateTeamConstraints = (teamA: Skater[], teamB: Skater[]): ConstraintReport => {
  const failures: string[] = []

  const checkTeam = (team: Skater[], label: string) => {
    const blockers = team.filter((skater) => getEffectiveRole(skater.position) === 'blocker').length
    const jammers = team.filter((skater) => skater.position === 'jammer').length

    if (blockers < 8) {
      failures.push(`${label}: may not have enough blockers; ${blockers} have been allocated. Check the level and try again.`)
    }

    if (jammers < 3) {
      failures.push(
        jammers === 0
          ? `${label}: has no jammers in the current selection. Check the level and try again.`
          : `${label}: may not have enough jammers; ${jammers} have been allocated. Check the level and try again.`,
      )
    }

    if (jammers > 5) {
      failures.push(`${label}: may have too many jammers; ${jammers} have been allocated.`)
    }
  }

  checkTeam(teamA, 'Team A')
  checkTeam(teamB, 'Team B')

  if (Math.abs(teamA.length - teamB.length) > 2) {
    failures.push(`Team sizes are uneven: Team A has ${teamA.length} and Team B has ${teamB.length}.`)
  }

  const teamASkill = teamA.reduce((sum, skater) => sum + skater.skillLevel, 0)
  const teamBSkill = teamB.reduce((sum, skater) => sum + skater.skillLevel, 0)
  const teamAExperience = teamA.reduce((sum, skater) => sum + skater.yearsPlaying, 0)
  const teamBExperience = teamB.reduce((sum, skater) => sum + skater.yearsPlaying, 0)

  if (Math.abs(teamASkill - teamBSkill) > 10) {
    failures.push(
      `Skill totals look uneven: Team A has ${teamASkill} and Team B has ${teamBSkill}. This may affect the balance of the scrim.`,
    )
  }

  if (Math.abs(teamAExperience - teamBExperience) > 6) {
    failures.push(
      `Experience totals look uneven: Team A has ${teamAExperience} and Team B has ${teamBExperience}. This may affect the balance of the scrim.`,
    )
  }

  return {
    valid: failures.length === 0,
    failures,
  }
}

export const generateScrimTeams = (skaters: Skater[], level: ScrimLevel): TeamResult => {
  const sorted = sortByPriority(skaters.filter((skater) => isEligibleForGame(skater, level)), level)
  return splitByTeam(sorted, level)
}
