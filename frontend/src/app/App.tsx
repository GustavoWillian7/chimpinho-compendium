import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { TreePage } from '../features/tree/TreePage';
import { Shell } from './Shell';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <Shell />, children: [{ index: true, element: <TreePage /> }] },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
