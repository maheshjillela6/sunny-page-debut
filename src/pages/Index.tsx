import React from 'react';
import LobbyPage from '@/ui/pages/LobbyPage';
import { ThemeProvider } from '../ui/providers/ThemeProvider';

const Index: React.FC = () => {
  return (
    <ThemeProvider>
       <LobbyPage />
    </ThemeProvider>
  );
};

export default Index;
