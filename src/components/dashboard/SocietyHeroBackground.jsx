import { useState, useEffect, useMemo, useRef } from "react";
import { getHeroEnvironment } from "../../utils/heroEnvironment";

export default function SocietyHeroBackground({ weather }) {
  // Current local time, updated once every 60 seconds
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const env = useMemo(() => {
    return getHeroEnvironment({
      currentTime,
      temperature: weather?.temp ?? 28,
      weatherCondition: weather?.condition ?? "Clear Sky",
    });
  }, [currentTime, weather?.temp, weather?.condition]);

  const [currentBg, setCurrentBg] = useState(env.heroImage);
  const [previousBg, setPreviousBg] = useState(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const crossfadeTimeoutRef = useRef(null);

  useEffect(() => {
    if (env.heroImage !== currentBg) {
      const img = new Image();
      img.src = env.heroImage;
      img.onload = () => {
        setPreviousBg(currentBg);
        setCurrentBg(env.heroImage);
        setIsCrossfading(true);

        if (crossfadeTimeoutRef.current) clearTimeout(crossfadeTimeoutRef.current);
        crossfadeTimeoutRef.current = setTimeout(() => {
          setIsCrossfading(false);
          setPreviousBg(null);
        }, 1800);
      };
      img.onerror = () => {
        console.warn("Hero asset failed to load, keeping current:", env.heroImage);
      };
    }
    return () => {
      if (crossfadeTimeoutRef.current) clearTimeout(crossfadeTimeoutRef.current);
    };
  }, [env.heroImage, currentBg]);

  return (
    <>
      {/* Previous Image Layer for smooth crossfade */}
      {previousBg && (
        <img
          src={previousBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-[1800ms] ease-in-out opacity-0 z-0"
        />
      )}

      {/* Current Active Image Layer with hover zoom */}
      <img
        src={currentBg}
        alt={env.altText}
        onError={(e) => {
          e.currentTarget.src = "/society-banner.jpg";
        }}
        className={`absolute inset-0 w-full h-full object-cover object-center pointer-events-none group-hover:scale-105 transition-all duration-[1800ms] ease-out z-0 ${
          isCrossfading ? "opacity-100 animate-in fade-in duration-[1800ms]" : "opacity-100"
        }`}
      />

      {/* Atmospheric CSS Overlays (Zero GPU overhead) */}
      {/* 1. Hot Summer / Extreme Heat Atmosphere */}
      {env.effects.heatAtmosphere && (
        <div
          className={`absolute inset-0 pointer-events-none z-[1] transition-opacity duration-1000 ${
            env.effects.extremeHotHaze
              ? "bg-gradient-to-tr from-amber-600/25 via-orange-500/15 to-amber-400/20 mix-blend-color-burn"
              : "bg-gradient-to-tr from-amber-500/15 via-orange-400/10 to-transparent mix-blend-overlay"
          }`}
        />
      )}

      {/* 2. Cold Winter Atmosphere */}
      {env.effects.winterAtmosphere && (
        <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-t from-cyan-950/20 via-sky-900/10 to-transparent mix-blend-soft-light transition-opacity duration-1000" />
      )}

      {/* 3. Fog / Mist Atmosphere */}
      {env.effects.fogMist && (
        <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-b from-slate-200/20 via-slate-100/15 to-transparent backdrop-blur-[0.5px] transition-opacity duration-1000" />
      )}

      {/* 4. Rainy Wet Surroundings & Sheen */}
      {env.effects.rainOverlay && (
        <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-b from-slate-900/35 via-slate-800/15 to-slate-950/45 mix-blend-multiply transition-opacity duration-1000" />
      )}

      {/* 5. Thunderstorm Ambient Atmosphere */}
      {env.effects.thunderstormFlash && (
        <div className="absolute inset-0 pointer-events-none z-[1] bg-slate-950/40 mix-blend-color-burn transition-opacity duration-1000" />
      )}

      {/* Base Legibility Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent z-[2] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-black/20 z-[2] pointer-events-none" />
    </>
  );
}
