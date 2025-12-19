import React from 'react';
import { LeapOrbitGame } from './components/LeapOrbitGame';

const App: React.FC = () => {
  return (
    // Mobile: h-[100dvh] handles dynamic address bars. Desktop (md): h-screen is standard and stable.
    <div className="w-full h-[100dvh] md:h-screen bg-neutral-900 text-white overflow-hidden relative touch-none overscroll-none">
      <LeapOrbitGame />
      <div className="scanlines absolute inset-0 z-50 opacity-20 pointer-events-none mix-blend-overlay" />
    </div>
  );
};

export default App;