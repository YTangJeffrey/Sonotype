'use client';

import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

type ParticleStage = 'float' | 'snap' | 'locked';

interface Particle {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  stage: ParticleStage;
  startX: number;
  startY: number;
  targetX?: number;
  targetY?: number;
  progress: number;
  finalIndex: number | null;
  isChar: boolean;
}

export interface ParticleCanvasHandle {
  emitFloatingParticle: (text: string, options?: { isChar?: boolean }) => void;
  promoteWordToFinal: (word: string, finalIndex: number) => void;
  reset: () => void;
}

interface ParticleCanvasProps {
  finalWords: string[];
  className?: string;
  style?: React.CSSProperties;
}

const FINAL_LINE_Y = 70;
const FLOAT_FONT = '500 18px "Inter", "Helvetica Neue", Arial, sans-serif';
const FINAL_FONT = '600 22px "Inter", "Helvetica Neue", Arial, sans-serif';

const easeInCubic = (t: number) => t * t * t;

const ParticleCanvasBase = (
  { finalWords, className, style }: ParticleCanvasProps,
  ref: ForwardedRef<ParticleCanvasHandle>
) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number>();

  const particlesRef = useRef<Particle[]>([]);
  const finalWordsRef = useRef<string[]>([]);
  const canvasMetricsRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 0,
    height: 0,
    dpr: 1,
  });

  const updateFinalTargets = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) {
      return;
    }

    const { width } = canvasMetricsRef.current;
    const words = finalWordsRef.current;
    if (!words.length) {
      return;
    }

    ctx.save();
    ctx.font = FINAL_FONT;
    const spaceWidth = ctx.measureText(' ').width;
    const totalWidth = words.reduce((sum, word, index) => {
      const wordWidth = ctx.measureText(word).width;
      return sum + wordWidth + (index > 0 ? spaceWidth : 0);
    }, 0);

    const startX = (width - totalWidth) / 2;
    let cursor = startX;

    const targets = words.map((word) => {
      const wordWidth = ctx.measureText(word).width;
      const centerX = cursor + wordWidth / 2;
      cursor += wordWidth + spaceWidth;
      return { x: centerX, y: FINAL_LINE_Y };
    });
    ctx.restore();

    particlesRef.current.forEach((particle) => {
      if (particle.finalIndex == null) {
        return;
      }
      const target = targets[particle.finalIndex];
      if (!target) {
        return;
      }
      particle.targetX = target.x;
      particle.targetY = target.y;
      if (particle.stage === 'locked') {
        particle.x = target.x;
        particle.y = target.y;
      }
    });
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvasEl = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvasEl || !ctx) {
      return;
    }

    const rect = canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    canvasMetricsRef.current = { width: rect.width, height: rect.height, dpr };

    updateFinalTargets();
  }, [updateFinalTargets]);

  const spawnParticle = useCallback(
    (text: string, config?: Partial<Particle>) => {
      const metrics = canvasMetricsRef.current;
      if (!metrics.width || !metrics.height) {
        return;
      }

      const baseX =
        metrics.width * 0.5 + (Math.random() - 0.5) * metrics.width * 0.6;
      const baseY = metrics.height - 30;

      const particle: Particle = {
        text,
        x: baseX,
        y: baseY,
        vx: (Math.random() - 0.5) * 26,
        vy: -50 - Math.random() * 36,
        alpha: 1,
        stage: 'float',
        startX: baseX,
        startY: baseY,
        progress: 0,
        finalIndex: null,
        isChar: text.length === 1,
        ...config,
      };

      if (particle.stage !== 'float') {
        particle.startX = baseX;
        particle.startY = baseY;
        particle.targetX = particle.targetX ?? baseX;
        particle.targetY = particle.targetY ?? FINAL_LINE_Y;
      }

      particlesRef.current.push(particle);
    },
    []
  );

  const emitFloatingParticle = useCallback(
    (text: string, options?: { isChar?: boolean }) => {
      spawnParticle(text, {
        isChar: options?.isChar ?? text.length === 1,
        stage: 'float',
      });
    },
    [spawnParticle]
  );

  const promoteWordToFinal = useCallback(
    (word: string, finalIndex: number) => {
      const particle =
        particlesRef.current
          .filter((item) => item.stage === 'float' && !item.isChar)
          .reverse()
          .find((item) => item.text.toLowerCase() === word.toLowerCase()) ?? null;

      if (particle) {
        particle.stage = 'snap';
        particle.startX = particle.x;
        particle.startY = particle.y;
        particle.progress = 0;
        particle.alpha = 1;
        particle.finalIndex = finalIndex;
      } else {
        spawnParticle(word, {
          stage: 'snap',
          finalIndex,
          isChar: false,
        });
      }

      requestAnimationFrame(updateFinalTargets);
    },
    [spawnParticle, updateFinalTargets]
  );

  const reset = useCallback(() => {
    particlesRef.current = [];
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      emitFloatingParticle,
      promoteWordToFinal,
      reset,
    }),
    [emitFloatingParticle, promoteWordToFinal, reset]
  );

  useEffect(() => {
    finalWordsRef.current = finalWords;
    requestAnimationFrame(updateFinalTargets);
  }, [finalWords, updateFinalTargets]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }
    const context = canvasEl.getContext('2d');
    if (!context) {
      return;
    }

    ctxRef.current = context;
    context.font = FLOAT_FONT;
    resizeCanvas();

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();

    const tick = (time: number) => {
      const ctx = ctxRef.current;
      if (!ctx) {
        return;
      }

      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        if (particle.stage === 'float') {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          particle.alpha -= delta * 0.22;
          particle.vx *= 0.992;
          particle.vy *= 0.985;

          if (
            particle.alpha <= 0 ||
            particle.y < -40 ||
            Number.isNaN(particle.x) ||
            Number.isNaN(particle.y)
          ) {
            particles.splice(i, 1);
          }
        } else if (particle.stage === 'snap') {
          particle.progress = Math.min(1, particle.progress + delta * 1.15);
          const eased = easeInCubic(particle.progress);
          if (particle.targetX != null && particle.targetY != null) {
            particle.x =
              particle.startX + (particle.targetX - particle.startX) * eased;
            particle.y =
              particle.startY + (particle.targetY - particle.startY) * eased;
          }
          if (particle.progress >= 1) {
            particle.stage = 'locked';
            particle.alpha = 1;
          }
        } else if (particle.stage === 'locked') {
          if (particle.targetX != null && particle.targetY != null) {
            particle.x += (particle.targetX - particle.x) * Math.min(1, delta * 8);
            particle.y += (particle.targetY - particle.y) * Math.min(1, delta * 8);
          }
          particle.alpha = 1;
        }
      }

      ctx.clearRect(
        0,
        0,
        canvasMetricsRef.current.width,
        canvasMetricsRef.current.height
      );
      ctx.save();
      ctx.font = FLOAT_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      particles.forEach((particle) => {
        ctx.globalAlpha = Math.max(0, Math.min(1, particle.alpha));
        ctx.fillStyle =
          particle.stage === 'locked'
            ? '#312e81'
            : particle.stage === 'snap'
            ? '#4338ca'
            : '#1d4ed8';
        ctx.fillText(particle.text, particle.x, particle.y);
      });

      ctx.restore();

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [resizeCanvas]);

  return <canvas ref={canvasRef} className={className} style={style} />;
};

export default forwardRef<ParticleCanvasHandle, ParticleCanvasProps>(
  ParticleCanvasBase
);
