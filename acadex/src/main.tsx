import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

if (window.__hideSplash) window.__hideSplash();
if (window.__clearStuckSw) window.__clearStuckSw();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
