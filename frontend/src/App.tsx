import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WellProvider } from './context/WellContext';
import AppLayout from './components/layout/AppLayout';

// Pages
import Login from './pages/Login';
import FleetOverview from './pages/FleetOverview';
import WellboreTwin from './pages/WellboreTwin';
import Telemetry from './pages/Telemetry';
import Hydraulics from './pages/Hydraulics';
import Specs from './pages/Specs';
import WhyAI from './pages/WhyAI';
import Compare from './pages/Compare';
import Investigate from './pages/Investigate';
import WhatIf from './pages/WhatIf';
import Replay from './pages/Replay';
import Studio from './pages/Studio';

// Protected Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Redirect authenticated users away from /login
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/wells" replace />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <WellProvider>
          <AppLayout />
        </WellProvider>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/wells" replace /> },
      { path: 'wells', element: <FleetOverview /> },
      { path: 'well/:id', element: <WellboreTwin /> },
      { path: 'well/:id/telemetry', element: <Telemetry /> },
      { path: 'well/:id/hydraulics', element: <Hydraulics /> },
      { path: 'well/:id/specs', element: <Specs /> },
      { path: 'well/:id/why', element: <WhyAI /> },
      { path: 'well/:id/compare', element: <Compare /> },
      { path: 'well/:id/investigate', element: <Investigate /> },
      { path: 'well/:id/what-if', element: <WhatIf /> },
      { path: 'well/:id/replay', element: <Replay /> },
      { path: 'studio', element: <Studio /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
