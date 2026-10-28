import { RouterProvider, createBrowserRouter } from 'react-router'
import { GameClientProvider } from './game/GameClientContext'
import { HomeScreen } from './screens/HomeScreen'
import { JoinScreen } from './screens/JoinScreen'
import { MatchScreen } from './screens/MatchScreen'

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/p/:code', element: <JoinScreen /> },
  { path: '/m/:id', element: <MatchScreen kind="remote" /> },
  { path: '/local/:id', element: <MatchScreen kind="local" /> },
])

export default function App() {
  return (
    <GameClientProvider>
      <RouterProvider router={router} />
    </GameClientProvider>
  )
}
