import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

// React Query owns the data layer: caching, retry and mutation state replace
// the hand-rolled loading/error flags the app used to carry per screen.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A reviewer is making regulatory decisions from this data; refetch when
      // they come back to the tab rather than trusting a stale cache.
      refetchOnWindowFocus: true,
      staleTime: 15_000,
      retry: (failureCount, error) =>
        // A dead backend or a 404 will not fix itself on retry; transient
        // network and 5xx failures might.
        error?.status === 0 || (error?.status >= 400 && error?.status < 500)
          ? false
          : failureCount < 2,
    },
    mutations: { retry: false },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
