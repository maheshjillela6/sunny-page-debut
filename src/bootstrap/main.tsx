/**
 * main.tsx - Application entry point
 */

import { createRoot } from 'react-dom/client';
import { App } from './App';
 
 // Initialize logger controller (exposes window.logger for debugging)
 import '../platform/logger';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(<App />);
