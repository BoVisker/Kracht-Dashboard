import { useMemo } from 'react'
import { useTrainingSessions } from './useTrainingSessions'
import { useCardioSessions } from './useCardioSessions'
import { useAchievements } from './useAchievements'
import { buildPeriodReport, type PeriodReport, type ReportPeriod } from '../lib/reports/periodReport'

/**
 * Composes the three data sources a report needs (training sessions, cardio
 * sessions, PR achievements) -- each already has its own cached useQuery
 * hook elsewhere in the app, so this reuses them rather than issuing new
 * network requests, and just runs the pure buildPeriodReport reducer over
 * whatever they return.
 */
export function useReport(period: ReportPeriod): { report: PeriodReport | null; isLoading: boolean } {
  const { data: trainingSessions, isLoading: trainingLoading } = useTrainingSessions()
  const { data: cardioSessions, isLoading: cardioLoading } = useCardioSessions()
  const { data: achievements, isLoading: achievementsLoading } = useAchievements()

  const report = useMemo<PeriodReport | null>(() => {
    if (!trainingSessions || !cardioSessions || !achievements) return null
    return buildPeriodReport(period, {
      trainingSessions: trainingSessions.map((s) => ({ date: new Date(s.date), setCount: s.setCount })),
      cardioSessions: cardioSessions.map((s) => ({ date: new Date(s.date), distanceMeters: s.distanceMeters, movingTimeSeconds: s.movingTimeSeconds })),
      achievements: achievements.map((a) => ({ date: a.date })),
    })
  }, [period, trainingSessions, cardioSessions, achievements])

  return { report, isLoading: trainingLoading || cardioLoading || achievementsLoading }
}
