import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { WhiteboardSession, StickyNote, BoardElement, PeerState } from './lib/engine';
import { getOrSetUserIdentity, saveUserName, saveUserColor } from './lib/identity';
import { generateRoomCode, getRoomFromURL, setRoomURL } from './lib/room';
import { Navbar } from './components/Navbar';
import { Whiteboard } from './components/Whiteboard';

export default function App() {
  // 1. Identity setup
  const [identity, setIdentity] = useState(() => getOrSetUserIdentity());
  const [userName, setUserName] = useState(identity.name);
  const [userColor, setUserColor] = useState(identity.color);

  // 2. Room code setup
  const [roomCode, setRoomCode] = useState<string>(() => {
    const existing = getRoomFromURL();
    if (existing) return existing;
    const fresh = generateRoomCode();
    setRoomURL(fresh);
    return fresh;
  });

  // 3. Active Tool ('select' | 'pen' | 'eraser')
  const [activeTool, setActiveTool] = useState<'select' | 'pen' | 'eraser'>('select');

  // 4. Whiteboard session instance
  const [session, setSession] = useState<WhiteboardSession | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);

  // 5. Clear board confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Initialize or re-create session when roomCode changes
  useEffect(() => {
    const newSession = new WhiteboardSession(roomCode, {
      id: identity.id,
      name: userName,
      color: userColor,
    });
    setSession(newSession);

    const unsub = newSession.subscribeAwareness(() => {
      setPeers(newSession.getPeers());
    });

    return () => {
      unsub();
      newSession.destroy();
    };
  }, [roomCode]);

  // Sync back/forward browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const code = getRoomFromURL();
      if (code && code !== roomCode) {
        setRoomCode(code);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [roomCode]);

  // Update Name
  const handleUpdateName = (newName: string) => {
    setUserName(newName);
    saveUserName(newName);
    if (session) {
      session.updateName(newName);
    }
  };

  // Update Color
  const handleUpdateColor = (newColor: string) => {
    setUserColor(newColor);
    saveUserColor(newColor);
    if (session) {
      session.updateColor(newColor);
    }
  };

  // Switch to new room
  const handleNewRoom = () => {
    const fresh = generateRoomCode();
    setRoomURL(fresh);
    setRoomCode(fresh);
  };

  // Join specific room
  const handleJoinRoom = (code: string) => {
    const clean = code.toUpperCase();
    setRoomURL(clean);
    setRoomCode(clean);
  };

  // Add sticky note
  const handleAddSticky = () => {
    if (!session) return;
    const colors: ('yellow' | 'green' | 'pink' | 'purple' | 'blue')[] = [
      'yellow',
      'green',
      'pink',
      'purple',
      'blue',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const existing = session.getAllElements();
    const maxZ = existing.reduce((max, el) => Math.max(max, el.zIndex || 0), 10);

    // Spread slightly so new notes don't completely overlap
    const offset = (existing.filter((e) => e.type === 'sticky').length % 6) * 25;

    const newNote: StickyNote = {
      id: `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'sticky',
      x: -120 + offset,
      y: -100 + offset,
      width: 220,
      height: 180,
      color: randomColor,
      text: '',
      authorName: userName,
      reactions: {},
      zIndex: maxZ + 1,
      updatedAt: Date.now(),
    };

    session.upsertElement(newNote);
    setActiveTool('select');
  };

  // Export as PNG
  const handleExportImage = () => {
    if (!session) return;
    const elements = session.getAllElements();
    if (elements.length === 0) {
      alert('The whiteboard is currently empty. Draw or add a note before exporting!');
      return;
    }

    // Determine bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((el) => {
      if (el.type === 'path') {
        el.points.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
      } else if (el.type === 'sticky') {
        if (el.x < minX) minX = el.x;
        if (el.y < minY) minY = el.y;
        if (el.x + el.width > maxX) maxX = el.x + el.width;
        if (el.y + el.height > maxY) maxY = el.y + el.height;
      }
    });

    const padding = 60;
    const width = Math.max(800, maxX - minX + padding * 2);
    const height = Math.max(600, maxY - minY + padding * 2);
    const originX = minX - padding;
    const originY = minY - padding;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Draw grid pattern on canvas export
    ctx.fillStyle = '#cbd5e1';
    for (let x = 0; x < width; x += 24) {
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render paths
    elements
      .filter((e) => e.type === 'path')
      .forEach((p) => {
        const pathEl = p as any;
        if (!pathEl.points || pathEl.points.length === 0) return;
        ctx.beginPath();
        ctx.strokeStyle = pathEl.color || '#1e293b';
        ctx.lineWidth = pathEl.strokeWidth || 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pts = pathEl.points;
        ctx.moveTo(pts[0].x - originX, pts[0].y - originY);
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const midX = (prev.x + curr.x) / 2 - originX;
          const midY = (prev.y + curr.y) / 2 - originY;
          ctx.quadraticCurveTo(prev.x - originX, prev.y - originY, midX, midY);
        }
        ctx.stroke();
      });

    // Render sticky notes
    const colorBgMap: Record<string, string> = {
      yellow: '#FEF3C7',
      green: '#D1FAE5',
      pink: '#FFE4E6',
      purple: '#F3E8FF',
      blue: '#E0F2FE',
    };
    const colorTextMap: Record<string, string> = {
      yellow: '#78350F',
      green: '#064E3B',
      pink: '#881337',
      purple: '#581C87',
      blue: '#0C4A6E',
    };

    elements
      .filter((e) => e.type === 'sticky')
      .forEach((s) => {
        const note = s as StickyNote;
        const nx = note.x - originX;
        const ny = note.y - originY;
        const nw = note.width;
        const nh = 160;

        // Card shadow & box
        ctx.save();
        ctx.fillStyle = colorBgMap[note.color] || '#FEF3C7';
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(nx, ny, nw, nh, 16);
        ctx.fill();
        ctx.stroke();

        // Author header
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(note.authorName || 'Collaborator', nx + 14, ny + 22);

        // Text content
        ctx.fillStyle = colorTextMap[note.color] || '#1e293b';
        ctx.font = '13px system-ui, -apple-system, sans-serif';
        const lines = (note.text || 'Untitled Note').split('\n');
        let textY = ny + 46;
        lines.slice(0, 6).forEach((line) => {
          ctx.fillText(line, nx + 14, textY, nw - 28);
          textY += 18;
        });

        // Reactions
        if (note.reactions) {
          let rx = nx + 14;
          Object.entries(note.reactions).forEach(([emoji, count]) => {
            if (count > 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.85)';
              ctx.beginPath();
              ctx.roundRect(rx, ny + nh - 28, 38, 18, 9);
              ctx.fill();
              ctx.fillStyle = '#0f172a';
              ctx.font = '10px system-ui, sans-serif';
              ctx.fillText(`${emoji} ${count}`, rx + 5, ny + nh - 15);
              rx += 44;
            }
          });
        }
        ctx.restore();
      });

    // Download triggered
    const link = document.createElement('a');
    link.download = `whiteboard-${roomCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleClearBoard = () => {
    if (session) {
      session.clearAll();
    }
    setShowClearConfirm(false);
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-50 flex flex-col font-sans select-none">
      {/* Top Navbar */}
      <Navbar
        roomCode={roomCode}
        userName={userName}
        userColor={userColor}
        peers={peers}
        onUpdateName={handleUpdateName}
        onUpdateColor={handleUpdateColor}
        onNewRoom={handleNewRoom}
        onJoinRoom={handleJoinRoom}
      />

      {/* Main Canvas Workspace */}
      {session && (
        <Whiteboard
          session={session}
          userName={userName}
          userColor={userColor}
          roomCode={roomCode}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onAddSticky={handleAddSticky}
          onClearBoard={() => setShowClearConfirm(true)}
          onExportImage={handleExportImage}
          onEditIdentity={() => {
            // Trigger profile edit modal
            const avatar = document.getElementById('identity-profile-btn') || document.querySelector('[title*="Click to change"]') as HTMLElement;
            if (avatar) avatar.click();
          }}
        />
      )}

      {/* Clear Board Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-slate-900">Clear Whiteboard?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This will remove all drawings and sticky notes for all connected peers in room{' '}
              <span className="font-mono font-bold text-indigo-600">{roomCode}</span>. This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                id="confirm-clear-board-btn"
                type="button"
                onClick={handleClearBoard}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition shadow-xs cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
