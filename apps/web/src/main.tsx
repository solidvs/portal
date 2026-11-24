import { PlatformProvider } from '@solidvs/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { Layout } from './app/Layout';
import { SessionProvider } from './auth/session';
import { CatalogProvider } from './data/catalog';
import { Deploys } from './pages/Deploys';
import { Home } from './pages/Home';
import { NoAccess } from './pages/NoAccess';
import { Project } from './pages/Project';
import { Projects } from './pages/Projects';
import { Stack } from './pages/Stack';

const router = createBrowserRouter([
  { path: '/sem-acesso', element: <NoAccess /> },
  {
    element: (
      <SessionProvider>
        <CatalogProvider>
          <Layout />
        </CatalogProvider>
      </SessionProvider>
    ),
    children: [
      { path: '/', element: <Home /> },
      { path: '/projetos', element: <Projects /> },
      { path: '/deploys', element: <Deploys /> },
      { path: '/stack', element: <Stack /> },
      { path: '/projetos/:projectId/:tab?', element: <Project /> },
    ],
  },
]);

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <PlatformProvider>
      <RouterProvider router={router} />
    </PlatformProvider>
  </StrictMode>,
);
