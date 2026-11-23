import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { NotePage } from '../features/notes/NotePage';
import { TopicPage } from '../features/notes/TopicPage';
import { TreePage } from '../features/tree/TreePage';
import { Shell } from './Shell';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <TreePage /> },
      { path: 'topics/:nodeId', element: <TopicPage /> },
      { path: 'notes/:id', element: <NotePage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
