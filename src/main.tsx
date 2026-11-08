import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installDiagnostics } from './lib/diagnostics';
import { AuthProvider } from './features/auth/AuthContext';
import { seedDatabase } from './features/training/db/seed';
import { initSettings } from './hooks/useSettings';
import './index.css';

installDiagnostics();

// The AI API integration was removed; drop any API key stored by it.
try {
  localStorage.removeItem('tracker.coach.apiKey');
  localStorage.removeItem('tracker.coach.model');
} catch {
  // storage unavailable
}

seedDatabase()
  .then(() => initSettings())
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    document.body.innerHTML =
      '<div style="padding:2rem;font-family:sans-serif;color:#f87171">' +
      '<h1>App kon niet opstarten</h1>' +
      '<p>Controleer of IndexedDB beschikbaar is in je browser.</p>' +
      '</div>';
  });
