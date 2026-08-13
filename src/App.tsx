import { lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/LoginPage'

// Lazy-loaded: these only matter post-login, and there are 12 of them --
// bundling all of them into the initial chunk (563kB before this change)
// makes every visitor download every page's code before seeing anything.
// LoginPage stays eager: it's the very first paint for a signed-out
// visitor, and small enough that splitting it out would just add a round
// trip for no benefit.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const TrainingPage = lazy(() => import('./pages/TrainingPage').then((m) => ({ default: m.TrainingPage })))
const CardioPage = lazy(() => import('./pages/CardioPage').then((m) => ({ default: m.CardioPage })))
const Cluster6Page = lazy(() => import('./pages/Cluster6Page').then((m) => ({ default: m.Cluster6Page })))
const ExercisePage = lazy(() => import('./pages/ExercisePage').then((m) => ({ default: m.ExercisePage })))
const ExercisesIndexPage = lazy(() => import('./pages/ExercisesIndexPage').then((m) => ({ default: m.ExercisesIndexPage })))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage').then((m) => ({ default: m.AchievementsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const RecoveryPage = lazy(() => import('./pages/RecoveryPage').then((m) => ({ default: m.RecoveryPage })))
const SyncPage = lazy(() => import('./pages/SyncPage').then((m) => ({ default: m.SyncPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

/**
 * HashRouter, not BrowserRouter: GitHub Pages serves static files with no
 * server-side rewrite, so a deep link to /goals would 404 on a hard
 * refresh under BrowserRouter unless a 404.html redirect hack is added.
 * HashRouter (/#/goals) needs no server cooperation at all — every route
 * from brief section 43K works as a direct link with zero extra moving
 * parts. Trade-off: URLs carry a '#'; revisit if a custom domain with a
 * proper rewrite rule is set up later.
 */
export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="cardio" element={<CardioPage />} />
            <Route path="cluster-6" element={<Cluster6Page />} />
            <Route path="exercises" element={<ExercisesIndexPage />} />
            <Route path="exercises/:id" element={<ExercisePage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="recovery" element={<RecoveryPage />} />
            <Route path="sync" element={<SyncPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
