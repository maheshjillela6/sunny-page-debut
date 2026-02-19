/**
 * App - Root application component
 */

import React from 'react';
import { Providers } from './Providers';
import { Router } from './Router';
import './global.css';

export const App: React.FC = () => {
  return (
    <Providers>
      <Router />
    </Providers>
  );
};

export default App;
