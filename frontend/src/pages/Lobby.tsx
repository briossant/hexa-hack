import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import Leaderboard from './Leaderboard';
import type { GameStartPayload } from '@hexa-hack/shared';

interface LobbyProps {
  onGameStart: (data: GameStartPayload) => void;
}

// Stable random seeds generated once at module load
const AVATAR_SEEDS = Array.from({ length: 24 }, (_, i) =>
  `lobby-${i}-${Math.random().toString(36).slice(2, 8)}`
);

function AvatarCarousel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const nextIndex = (index + 1) % AVATAR_SEEDS.length;

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % AVATAR_SEEDS.length);
        setVisible(true);
      }, 200);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-center mb-8">
      <img
        key={nextIndex}
        src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(AVATAR_SEEDS[nextIndex])}`}
        aria-hidden="true"
        style={{ display: 'none' }}
        alt=""
      />
      <div
        style={{
          width: 112,
          height: 112,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.88)',
          transition: visible
            ? 'opacity 0.3s ease, transform 0.3s ease'
            : 'opacity 0.2s ease, transform 0.2s ease',
        }}
        className="rounded-full overflow-hidden border-4 border-coral/25 shadow-xl shadow-coral/10"
      >
        <img
          src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(AVATAR_SEEDS[index])}`}
          alt="avatar preview"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

const DEMO_MESSAGES = [
  { id: '1', name: 'Zephyr',  seed: 'zephyr-demo',  text: 'ok so who do we trust here',                                      delay: 800  },
  { id: '2', name: 'Mira',    seed: 'mira-demo',    text: 'not sure, felt like Orion was deflecting earlier',                 delay: 2200 },
  { id: '3', name: 'Orion',   seed: 'orion-demo',   text: 'I understand the concern. I was simply offering a balanced perspective on the situation.', delay: 3800 },
  { id: '4', name: 'Jade',    seed: 'jade-demo',    text: 'lol orion sounds like a chatbot',                                 delay: 5600 },
  { id: '5', name: 'Orion',   seed: 'orion-demo',   text: 'That is a fair observation. I will try to be more direct.',       delay: 7200 },
  { id: '6', name: 'Zephyr',  seed: 'zephyr-demo',  text: 'yeah... voting Orion',                                            delay: 9000 },
  { id: '7', name: 'Mira',    seed: 'mira-demo',    text: 'same',                                                            delay: 10200 },
];
const DEMO_LOOP_MS = 13000;

function FakeChat() {
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = () => {
      setVisibleIds([]);
      timers = DEMO_MESSAGES.map((msg) =>
        setTimeout(() => setVisibleIds((v) => [...v, msg.id]), msg.delay),
      );
    };

    schedule();
    const loop = setInterval(schedule, DEMO_LOOP_MS);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  const visibleMessages = DEMO_MESSAGES.filter((m) => visibleIds.includes(m.id));

  return (
    <div className="flex flex-col bg-white border border-mauve/15 rounded-2xl overflow-hidden shadow-sm w-72 flex-none">
      <div className="px-3 py-2 border-b border-mauve/10 shrink-0 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
        <span className="text-xs font-medium text-mauve">Round 2 · Elimination vote</span>
      </div>
      <div className="flex flex-col justify-end gap-2 p-3 overflow-hidden" style={{ height: 280 }}>
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex gap-2 items-start animate-fade-in-up flex-none"
          >
            <img
              src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(msg.seed)}`}
              alt={msg.name}
              className="w-6 h-6 rounded-full flex-none mt-0.5 border border-mauve/10"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs text-mauve/60">{msg.name}</span>
              <div className="text-xs px-2.5 py-1.5 rounded-xl bg-shell text-ink border border-mauve/10 break-words" style={{ maxWidth: 200 }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScrollArrow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Scroll to ${label}`}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-mauve/35 hover:text-mauve/60 transition-colors"
    >
      <span className="text-[10px] tracking-[0.2em] uppercase font-semibold">{label}</span>
      <svg
        className="animate-bounce"
        width="22" height="22" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}


export default function Lobby({ onGameStart }: LobbyProps) {
  const [status, setStatus] = useState<'idle' | 'queued'>('idle');
  const [position, setPosition] = useState(0);
  const [realName, setRealName] = useState('');
  const rulesRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.connect();

    socket.on('queue:joined', ({ position }) => {
      setStatus('queued');
      setPosition(position);
    });

    socket.on('game:start', (data) => {
      onGameStart(data);
    });

    return () => {
      socket.off('queue:joined');
      socket.off('game:start');
    };
  }, [onGameStart]);

  const joinQueue = () => {
    socket.emit('queue:join', { realName: realName.trim() || undefined });
    setStatus('queued');
  };

  return (
    <div className="bg-shell h-screen overflow-y-scroll snap-y snap-mandatory">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="h-screen snap-start flex flex-col items-center justify-center px-4 relative">
        <div className="w-full max-w-md flex flex-col items-center text-center">
          <AvatarCarousel />

          <h1 className="text-5xl sm:text-6xl font-bold text-ink mb-3 tracking-tight">
            Bot Among Us
          </h1>
          <p className="text-mauve text-base mb-10">
            Find the AIs among the players before they outnumber you.
          </p>

          {status === 'idle' ? (
            <div className="flex flex-col gap-3 w-full">
              <input
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinQueue()}
                placeholder="Name (revealed when eliminated)"
                maxLength={40}
                className="w-full border border-mauve/25 rounded-xl px-4 py-3 text-ink bg-white focus:outline-none focus:border-mauve/60 transition placeholder:text-mauve/40"
              />
              <button
                onClick={joinQueue}
                className="w-full bg-coral text-white rounded-xl py-3 font-medium hover:bg-coral/90 transition"
              >
                Join Queue
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-sage animate-pulse" />
                <span className="text-ink font-medium">
                  Waiting for players&nbsp;&mdash;&nbsp;<strong>{position}</strong> in queue
                </span>
              </div>
              <p className="text-mauve/60 text-xs">
                Game starts when enough players join, or after 30 seconds.
              </p>
            </div>
          )}
        </div>

        <ScrollArrow onClick={() => rulesRef.current?.scrollIntoView({ behavior: 'smooth' })} label="How it works" />
      </div>

      {/* ── Rules + Analysis (single snap block, free scroll inside) ── */}
      <div
        ref={rulesRef}
        className="snap-start overflow-y-auto"
        style={{ height: '100vh' }}
      >
        <div className="flex justify-center px-4">
          <div className="w-full max-w-4xl">

            {/* Rules */}
            <div className="pt-24 pb-16 flex flex-col lg:flex-row gap-12 items-start">
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-2 tracking-tight">
                  How it works
                </h2>
                <p className="text-mauve text-sm mb-4 leading-relaxed">
                  You're in a room with strangers. Some are human, some are AIs. Nobody knows who is who, not even the AIs know each other.
                </p>
                <p className="text-mauve text-sm mb-4 leading-relaxed">
                  Before the first round, everyone votes to elect a mayor. The mayor has one power: if a vote ends in a tie, their pick decides who gets eliminated. They keep that role until they're voted out, then a new election happens.
                </p>
                <p className="text-mauve text-sm mb-4 leading-relaxed">
                  Each round, players chat freely and then vote to eliminate someone. Whoever gets the most votes is out, and their identity is revealed. Was it a human? An AI? You'll find out.
                </p>
                <p className="text-mauve text-sm leading-relaxed">
                  Humans win by eliminating all the AIs. The AIs win if they ever match or outnumber the humans still alive. Every vote counts.
                </p>
              </div>
              <FakeChat />
            </div>

            {/* Analysis */}
            <div ref={analysisRef} className="pb-24">
              <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-2 tracking-tight">
                A living Turing Test
              </h2>
              <p className="text-mauve text-sm mb-8">
                Every game is a blind experiment. Real humans try to unmask the bots, without knowing which model they're facing.
                The rankings below emerge from that pressure: which AI can hold a conversation, blend in, and survive the vote?
                Not a lab benchmark. A social one.
              </p>
              <div className="border border-mauve/15 rounded-2xl bg-white overflow-hidden shadow-sm">
                <Leaderboard />
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-mauve/10 px-4 py-10">
          <div className="flex justify-center">
            <div className="w-full max-w-4xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

              <div>
                <p className="text-xs text-mauve/50">
                  Built for the{' '}
                  <span className="text-ink/70 font-medium">Tech Europe Hackathon</span>
                </p>
                <a
                  href="https://github.com/briossant/BotAmoungUs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-mauve/40 hover:text-mauve/70 transition-colors mt-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  briossant/BotAmoungUs
                </a>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { name: 'Nathan Champagne',  url: 'https://www.linkedin.com/in/nathan-champagne/' },
                  { name: 'Antoine Monot',     url: 'https://www.linkedin.com/in/antoine-monot/' },
                  { name: 'Brieuc Crosson',    url: 'https://www.linkedin.com/in/brieuc-crosson/' },
                  { name: 'Ksenia Ossi',       url: 'https://www.linkedin.com/in/ksenia-ossi' },
                ].map(({ name, url }) => (
                  <a
                    key={name}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-mauve/40 hover:text-mauve/70 transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    {name}
                  </a>
                ))}
              </div>

            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
