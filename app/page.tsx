'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ParticleCanvas, {
  ParticleCanvasHandle,
} from './components/ParticleCanvas';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import styles from './page.module.css';

const Page = (): JSX.Element => {
  const [finalWords, setFinalWords] = useState<string[]>([]);
  const [pulses, setPulses] = useState<Array<{ id: number; word: string }>>([]);
  const particleCanvasRef = useRef<ParticleCanvasHandle | null>(null);
  const interimTokensRef = useRef<string[]>([]);
  const pulseTimeoutsRef = useRef(
    new Map<number, ReturnType<typeof setTimeout>>()
  );

  const emitPulse = useCallback((word: string) => {
    const id = Date.now() + Math.random();
    setPulses((current) => [...current, { id, word }]);

    const timeout = setTimeout(() => {
      setPulses((current) => current.filter((pulse) => pulse.id !== id));
      pulseTimeoutsRef.current.delete(id);
    }, 2400);

    pulseTimeoutsRef.current.set(id, timeout);
  }, []);

  useEffect(
    () => () => {
      pulseTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      pulseTimeoutsRef.current.clear();
    },
    []
  );

  const handleInterimUpdate = useCallback((interim: string) => {
    if (!interim) {
      interimTokensRef.current = [];
      return;
    }

    const canvas = particleCanvasRef.current;
    const tokens = interim
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const previous = interimTokensRef.current;

    if (!canvas) {
      interimTokensRef.current = tokens;
      return;
    }

    tokens.forEach((token, index) => {
      if (index >= previous.length) {
        canvas.emitFloatingParticle(token, { isChar: false });
        return;
      }

      if (index === tokens.length - 1 && token.length > previous[index].length) {
        const diff = token.slice(previous[index].length);
        diff.split('').forEach((char) => {
          canvas.emitFloatingParticle(char, { isChar: true });
        });
      }
    });

    interimTokensRef.current = tokens;
  }, []);

  const handleFinalResult = useCallback((transcript: string) => {
    const tokens = transcript
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    if (!tokens.length) {
      return;
    }

    setFinalWords((current) => {
      const nextWords = [...current, ...tokens];
      tokens.forEach((word, offset) => {
        const finalIndex = current.length + offset;
        particleCanvasRef.current?.promoteWordToFinal(word, finalIndex);
        emitPulse(word);
      });
      return nextWords;
    });

    interimTokensRef.current = [];
  }, [emitPulse]);

  const {
    isSupported,
    isListening,
    startListening,
    stopListening,
    statusLabel,
  } = useSpeechRecognition({
    lang: 'en-US',
    onFinalResult: handleFinalResult,
    onInterimUpdate: handleInterimUpdate,
  });

  const handleToggle = useCallback(() => {
    if (!isSupported) {
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    interimTokensRef.current = [];
    setFinalWords([]);
    particleCanvasRef.current?.reset();
    pulseTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pulseTimeoutsRef.current.clear();
    setPulses([]);
    startListening();
  }, [isListening, isSupported, startListening, stopListening]);

  const finalSentence = useMemo(() => finalWords.join(' '), [finalWords]);

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <header>
          <h1 className={styles.heading}>Speech Particle Canvas</h1>
          <p className={styles.description}>
            Start the microphone, speak naturally, and watch each spoken fragment rise
            as animated text particles. Confirmed words align to the sentence at the
            top once the speech recognition finalizes.
          </p>
        </header>

        <div className={styles.controls}>
          <button
            type="button"
            onClick={handleToggle}
            className={`${styles.button} ${
              isSupported ? '' : styles.buttonDisabled
            }`}
            disabled={!isSupported}
          >
            {isListening ? 'Stop' : 'Start'}
          </button>
          <div className={styles.indicator}>
            {isListening && <span className={styles.indicatorDot} />}
            <span>{statusLabel}</span>
          </div>
        </div>

        {!isSupported && (
          <div className={styles.supportWarning}>
            Your browser does not expose the Web Speech API (SpeechRecognition). Try
            using the latest version of Chrome or Edge on desktop.
          </div>
        )}

        <div className={styles.scene}>
          <div className={styles.finalText}>
            {finalWords.length ? (
              finalSentence
            ) : (
              <span className={styles.placeholder}>
                The finalized sentence will settle here as you speak.
              </span>
            )}
          </div>
          <ParticleCanvas
            ref={particleCanvasRef}
            finalWords={finalWords}
            className={styles.canvas}
          />
          <div className={styles.signalLayer}>
            {pulses.map((pulse) => (
              <div key={pulse.id} className={styles.pulse} aria-hidden="true" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Page;
