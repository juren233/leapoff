import React from 'react';
import { LeapOrbitGame } from './components/LeapOrbitGame';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-neutral-900 text-white overflow-hidden relative">
      <LeapOrbitGame />
      <div className="scanlines absolute inset-0 z-50 opacity-20 pointer-events-none mix-blend-overlay" />
    </div>
  );
};

export default App;