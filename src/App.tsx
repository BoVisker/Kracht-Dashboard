import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { GoalsPage } from './pages/GoalsPage'
import { TrainingPage } from './pages/TrainingPage'
import { CardioPage } from './pages/CardioPage'
import { Cluster6Page } from './pages/Cluster6Page'
import { ExercisePage } from './pages/ExercisePage'
import { SyncPage } from './pages/SyncPage'
import { SettingsPage } from './pages/SettingsPage'

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
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="training" element={<TrainingPage />} />
          <Route path="cardio" element={<CardioPage />} />
          <Route path="cluster-6" element={<Cluster6Page />} />
          <Route path="exercises/:slug" element={<ExercisePage />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
