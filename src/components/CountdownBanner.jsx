import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CountdownBanner = () => {
  const targetDate = new Date('2026-08-08T00:00:00').getTime();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  // Star config matching the visual references in the mockup image
  const stars = [
    { top: '25%', left: '4%', size: 10, color: '#fbbf24', delay: 0 },
    { top: '35%', left: '40%', size: 8, color: '#ffffff', delay: 1.5 },
    { top: '70%', left: '36%', size: 12, color: '#ffffff', delay: 0.8 },
    { top: '22%', left: '80%', size: 10, color: '#fbbf24', delay: 1.1 },
    { top: '72%', left: '81%', size: 9, color: '#fbbf24', delay: 2.2 },
    { top: '32%', left: '96%', size: 11, color: '#fbbf24', delay: 1.9 },
  ];

  return (
    <div className="relative overflow-hidden mb-6 rounded-3xl p-[1px] shadow-2xl transition-all duration-300 hover:shadow-indigo-500/20">
      {/* Visual background gradient matches the exact purple-indigo design in image */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, #4f46e5 0%, #7f80b4ff 35%, #312e81 70%, #1e1b4b 100%)',
        }}
      />

      {/* Radiant Glow overlays to make the gradient rich */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Floating 4-pointed Sparkle SVG Elements based on image */}
      {stars.map((star, idx) => (
        <motion.div
          key={idx}
          className="absolute pointer-events-none"
          style={{
            top: star.top,
            left: star.left,
            width: star.size * 1.5,
            height: star.size * 1.5,
          }}
          animate={{
            scale: [0.6, 1.2, 0.6],
            opacity: [0.4, 0.9, 0.4],
          }}
          transition={{
            duration: 3 + star.size * 0.1,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        >
          <svg viewBox="0 0 24 24" fill={star.color} className="w-full h-full drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]">
            <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" />
          </svg>
        </motion.div>
      ))}

      {/* Main Content Layout */}
      <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-6 px-8 py-5 backdrop-blur-[4px] bg-white/[0.01] border border-white/[0.06] rounded-[23px] overflow-hidden">

        {/* Left Side: Premium Animated Rocket with Clouds & Dynamic Text Titles */}
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          {/* Animated custom illustration Rocket */}
          <motion.div
            className="flex-shrink-0 cursor-pointer select-none"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            whileHover={{ scale: 1.05 }}
          >
            <svg viewBox="0 0 120 120" className="w-[88px] h-[88px] drop-shadow-[0_4px_15px_rgba(255,255,255,0.25)]">
              {/* Engine Exhaust/Fire flame */}
              <g>
                <path d="M 60 72 Q 48 94 60 110 Q 72 94 60 72 Z" fill="#ff4d4d" opacity="0.9" />
                <path d="M 60 78 Q 52 94 60 105 Q 68 94 60 78 Z" fill="#ffa500" opacity="0.9" />
                <path d="M 60 84 Q 55 94 60 98 Q 65 94 60 84 Z" fill="#ffff00" opacity="0.9" />
              </g>
              {/* Side Wings/Fins */}
              <path d="M 45 68 L 33 82 C 32 84 39 84 44 78 Z" fill="#ef4444" />
              <path d="M 75 68 L 87 82 C 88 84 81 84 76 78 Z" fill="#ef4444" />
              {/* Rocket Main Fuselage Body */}
              <path d="M 60 15 C 44 38 44 66 44 76 C 50 80 70 80 76 76 C 76 66 76 38 60 15 Z" fill="#ffffff" />
              {/* Circular Window */}
              <circle cx="60" cy="46" r="11" fill="#e2e8f0" />
              <circle cx="60" cy="46" r="8" fill="#38bdf8" />
              <path d="M 55 42 A 8 8 0 0 1 65 42" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
              {/* Nose Cone */}
              <path d="M 60 15 C 52 25 48 34 46 40 C 54 43 66 43 74 40 C 72 34 68 25 60 15 Z" fill="#ef4444" />
              {/* Fluffy white launching clouds below the rocket body */}
              <ellipse cx="28" cy="98" rx="18" ry="10" fill="#ffffff" opacity="0.8" />
              <ellipse cx="92" cy="98" rx="18" ry="10" fill="#ffffff" opacity="0.8" />
              <ellipse cx="60" cy="100" rx="26" ry="12" fill="#ffffff" />
            </svg>
          </motion.div>

          {/* Banner Texts matching the exact fonts and layouts in user mockup */}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              System Launch Countdown
            </h2>
            <p className="text-xs font-semibold text-indigo-100/90 tracking-wide">
              Get ready! The COCPIT goes live on
            </p>
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
              08 August 2026
            </span>
          </div>
        </div>

        {/* Middle Section: Transparent glassmorphic numeric blocks */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center my-2 xl:my-0">
          {[
            { label: 'DAYS', value: timeLeft.days },
            { label: 'HOURS', value: timeLeft.hours },
            { label: 'MINUTES', value: timeLeft.minutes },
            { label: 'SECONDS', value: timeLeft.seconds },
          ].map((block, i) => (
            <motion.div
              key={i}
              className="flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] h-[78px] sm:h-[86px] rounded-2xl bg-white/[0.08] border border-white/[0.12] shadow-lg relative overflow-hidden backdrop-blur-md"
              style={{
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxShadow: 'inset 0 2px 8px rgba(255, 255, 255, 0.08), 0 8px 32px rgba(0, 0, 0, 0.2)',
              }}
              whileHover={{ scale: 1.04, borderColor: 'rgba(255, 255, 255, 0.3)' }}
            >
              {/* Glassmorphic upper overlay glare reflection */}
              <div className="absolute top-0 left-0 right-0 h-[48%] bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />

              <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter drop-shadow-[0_2px_5px_rgba(0,0,0,0.4)]">
                {String(block.value).padStart(2, '0')}
              </span>
              <span className="text-[8px] sm:text-[9px] font-black text-indigo-200 tracking-wider uppercase mt-1 opacity-90">
                {block.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Right Section: Bullseye Target Board graphic + Motivational Microcopy */}
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] p-3 rounded-2xl max-w-[270px]">
          {/* Target board Custom Vector graphic */}
          <div className="flex-shrink-0">
            <svg viewBox="0 0 60 60" className="w-[46px] h-[46px] drop-shadow-[0_2px_10px_rgba(129,140,248,0.4)]">
              {/* Target rings */}
              <circle cx="30" cy="30" r="26" fill="#818cf8" fillOpacity="0.15" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.3" />
              <circle cx="30" cy="30" r="21" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="3 2" />
              <circle cx="30" cy="30" r="16" fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" />
              <circle cx="30" cy="30" r="10" fill="#818cf8" fillOpacity="0.6" stroke="#ffffff" strokeWidth="1.5" />
              <circle cx="30" cy="30" r="4" fill="#ffffff" />

              {/* Arrow stuck in the bullseye */}
              <g transform="rotate(-45 30 30)">
                {/* Arrow shaft */}
                <line x1="30" y1="30" x2="6" y2="30" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                {/* Arrow flight feathers */}
                <path d="M 6 27 L 1 25 L 3 30 L 1 35 L 6 33 Z" fill="#fbbf24" />
                <path d="M 8 28 L 5 27 L 6 30 L 5 33 L 8 32 Z" fill="#fbbf24" opacity="0.8" />
              </g>
            </svg>
          </div>

          <p className="text-xs font-bold text-indigo-100 leading-snug tracking-normal">
            Let's achieve launch targets together!
          </p>
        </div>

      </div>
    </div>
  );
};

export default CountdownBanner;
