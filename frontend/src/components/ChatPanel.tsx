import { useEffect, useRef } from 'react';
import type { GameMessage, PublicPlayer, GamePhase } from '@hexa-hack/shared';

interface ChatPanelProps {
  messages: GameMessage[];
  players: PublicPlayer[];
  myId: string;
  phase: GamePhase;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}

export default function ChatPanel({ messages, players, myId, phase, input, onInputChange, onSend }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col bg-white border border-mauve/15 rounded-2xl overflow-hidden h-52 lg:h-auto lg:w-80 flex-none">
      <div className="px-3 py-2 border-b border-mauve/10 shrink-0">
        <span className="text-xs font-medium text-mauve">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-mauve/50 text-center mt-4">No messages yet</p>
        )}
        {messages.map((msg) => {
          const player = playerMap[msg.playerId];
          const isMe = msg.playerId === myId;
          return (
            <div key={msg.id} className={`flex gap-2 items-start ${isMe ? 'flex-row-reverse' : ''}`}>
              <img
                src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(player?.avatarSeed ?? msg.playerId)}`}
                alt={msg.playerName}
                className="w-6 h-6 rounded-full flex-none mt-0.5 border border-mauve/10"
              />
              <div className={`flex flex-col gap-0.5 min-w-0 ${isMe ? 'items-end' : ''}`}>
                <span className="text-xs text-mauve/60">{msg.playerName}</span>
                <div className={`text-xs px-2.5 py-1.5 rounded-xl break-words max-w-48 ${isMe ? 'bg-ink text-shell' : 'bg-shell text-ink border border-mauve/10'}`}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {phase === 'discussion' && (
        <div className="flex gap-2 p-3 border-t border-mauve/10 shrink-0">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Say something..."
            maxLength={300}
            className="flex-1 min-w-0 border border-mauve/25 rounded-xl px-3 py-2 text-ink bg-white focus:outline-none focus:border-mauve/60 transition text-xs placeholder:text-mauve/40"
          />
          <button
            onClick={onSend}
            disabled={!input.trim()}
            className="px-3 py-2 bg-ink text-shell text-xs font-medium rounded-xl hover:bg-ink/90 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
