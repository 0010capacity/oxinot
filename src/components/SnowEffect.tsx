import React, { useEffect, useState } from 'react';
import './SnowEffect.css';

interface Snowflake {
  id: number;
  left: number;
  animationDuration: number;
  animationDelay: number;
  size: number;
  opacity: number;
}

export const SnowEffect: React.FC = () => {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const count = 50;
    const newSnowflakes: Snowflake[] = [];

    for (let i = 0; i < count; i++) {
      newSnowflakes.push({
        id: i,
        left: Math.random() * 100,
        animationDuration: Math.random() * 5 + 3, // 3-8s
        animationDelay: Math.random() * 5,
        size: Math.random() * 3 + 2, // 2-5px
        opacity: Math.random() * 0.5 + 0.3, // 0.3-0.8
      });
    }

    setSnowflakes(newSnowflakes);
  }, []);

  return (
    <div className="snow-container" aria-hidden="true">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="snowflake"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: `${flake.animationDuration}s`,
            animationDelay: `${flake.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
};
