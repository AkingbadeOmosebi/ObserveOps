import React, { useState, useEffect } from 'react';

function LandingHero({ onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),   // Image appears
      setTimeout(() => setStage(2), 1500),  // Title appears
      setTimeout(() => setStage(3), 2500),  // Subtitle appears
      setTimeout(() => setStage(4), 3500),  // Slide transition starts
      setTimeout(() => onComplete(), 4000), // Show login form
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  if (stage >= 4) return null;

  return (
    <div className={`landing-hero ${stage >= 3 ? 'slide-out' : ''}`}>
      <div className="hero-content">
        <img 
          src="/hero-image.png" 
          alt="Digital payment platform" 
          className={`hero-image ${stage >= 1 ? 'visible' : ''}`}
        />
        
        <div className="hero-text">
          <h1 className={`hero-title ${stage >= 2 ? 'visible' : ''}`}>
            ObserveOps
          </h1>
          <p className={`hero-subtitle ${stage >= 3 ? 'visible' : ''}`}>
            Your Digital Payment Platform
          </p>
        </div>
      </div>

      <button 
        className={`skip-button ${stage >= 1 ? 'visible' : ''}`}
        onClick={() => onComplete()}
      >
        Skip intro →
      </button>
    </div>
  );
}

export default LandingHero;
