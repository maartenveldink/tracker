import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { seedDatabase } from './features/training/db/seed';
import './index.css';

seedDatabase()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
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
