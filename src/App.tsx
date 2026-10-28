import { RouterProvider, createBrowserRouter } from 'react-router'
import { GameClientProvider } from './game/GameClientContext'
import { CrashScreen } from './screens/CrashScreen'
import { LoadingScreen } from './ui/Loading'

// Cada tela num arquivo próprio: o primeiro carregamento baixa só a tela aberta.
const router = createBrowserRouter([
  {
    errorElement: <CrashScreen />,
    HydrateFallback: LoadingScreen,
    children: [
      { path: '/', lazy: () => import('./screens/HomeScreen').then((m) => ({ Component: m.HomeScreen })) },
      { path: '/p/:code', lazy: () => import('./screens/JoinScreen').then((m) => ({ Component: m.JoinScreen })) },
      { path: '/m/:id', lazy: () => import('./screens/MatchScreen').then((m) => ({ Component: m.RemoteMatchScreen })) },
      { path: '/local/:id', lazy: () => import('./screens/MatchScreen').then((m) => ({ Component: m.LocalMatchScreen })) },
    ],
  },
])

export default function App() {
  return (
    <GameClientProvider>
      <RouterProvider router={router} />
    </GameClientProvider>
  )
}
