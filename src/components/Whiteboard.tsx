import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  WhiteboardSession,
  BoardElement,
  StickyNote as StickyNoteType,
  FreehandPath,
  PeerState,
} from '../lib/engine';
import { StickyNote } from './StickyNote';
import {
  Hand,
  Pencil,
  Eraser,
  Plus,
  RotateCcw,
  Download,
  Trash2,
  Minus,
  Maximize2,
  Database,
  CheckCircle2,
} from 'lucide-react';

interface WhiteboardProps {
  session: WhiteboardSession;
  userName: string;
  userColor: string;
  roomCode: string;
  activeTool: 'select' | 'pen' | 'eraser';
  onSelectTool: (tool: 'select' | 'pen' | 'eraser') => void;
  onAddSticky: () => void;
  onClearBoard: () => void;
  onExportImage: () => void;
  onEditIdentity?: () => void;
}

const STROKE_COLORS = ['#1E293B', '#4F46E5', '#059669', '#D97706', '#E11D48', '#0284C7', '#7C3AED'];
const STROKE_WIDTHS = [2, 4, 8];

// Convert array of points to smooth SVG path
function getSvgPathFromPoints(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  session,
  userName,
  userColor,
  roomCode,
  activeTool,
  onSelectTool,
  onAddSticky,
  onClearBoard,
  onExportImage,
  onEditIdentity,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; origPanX: number; origPanY: number } | null>(null);
  const spacePressedRef = useRef<boolean>(false);

  // Collaborative State
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [peers, setPeers] = useState<PeerState[]>([]);

  // Pen / Drawing State
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [penColor, setPenColor] = useState<string>('#4F46E5');
  const [penWidth, setPenWidth] = useState<number>(4);

  // Subscribe to Yjs changes
  useEffect(() => {
    // Initial fetch
    setElements(session.getAllElements());
    setPeers(session.getPeers());

    // Observe doc updates
    const unSubElements = session.subscribeElements(() => {
      setElements(session.getAllElements());
    });

    // Observe peer awareness updates
    const unSubAwareness = session.subscribeAwareness(() => {
      setPeers(session.getPeers());
    });

    return () => {
      unSubElements();
      unSubAwareness();
    };
  }, [session]);

  // Center canvas on first load
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setPan({ x: clientWidth / 2, y: clientHeight / 2 });
    }
  }, []);

  // Keyboard navigation (Space for pan)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spacePressedRef.current && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        spacePressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Screen to Canvas Coordinates helper
  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      return {
        x: (rawX - pan.x) / zoom,
        y: (rawY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Zoom centered on pointer
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.2), 3.5);

    if (newZoom === zoom) return;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Pointer Down (Draw, Pan, or Erase)
  const handlePointerDown = (e: React.PointerEvent) => {
    const isMiddleClick = e.button === 1;
    const isSpacePan = spacePressedRef.current || activeTool === 'select';

    if (isMiddleClick || isSpacePan) {
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
      return;
    }

    const coords = toCanvasCoords(e.clientX, e.clientY);

    if (activeTool === 'pen') {
      setCurrentStroke([coords]);
    }
  };

  // Pointer Move (Cursor update, Panning, Drawing, Erasing)
  const handlePointerMove = (e: React.PointerEvent) => {
    const coords = toCanvasCoords(e.clientX, e.clientY);

    // Broadcast cursor to peers
    session.sendCursor(coords);

    // If panning
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.origPanX + dx,
        y: panStartRef.current.origPanY + dy,
      });
      return;
    }

    // If drawing
    if (currentStroke && activeTool === 'pen') {
      setCurrentStroke((prev) => (prev ? [...prev, coords] : [coords]));
    }

    // If erasing with mouse down
    if (activeTool === 'eraser' && (e.buttons & 1) === 1) {
      eraseNearPoint(coords.x, coords.y);
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }

    if (currentStroke && currentStroke.length > 0 && activeTool === 'pen') {
      const newPath: FreehandPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'path',
        points: currentStroke,
        color: penColor,
        strokeWidth: penWidth,
        zIndex: 1,
        updatedAt: Date.now(),
      };
      session.upsertElement(newPath);
      setCurrentStroke(null);
    }
  };

  const handlePointerLeave = () => {
    session.sendCursor(null);
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
    if (currentStroke) {
      handlePointerUp();
    }
  };

  // Erase nearby paths
  const eraseNearPoint = (x: number, y: number) => {
    const threshold = 18 / zoom;
    elements.forEach((el) => {
      if (el.type === 'path') {
        const isNear = el.points.some((p) => {
          const dist = Math.hypot(p.x - x, p.y - y);
          return dist < threshold + el.strokeWidth;
        });
        if (isNear) {
          session.removeElement(el.id);
        }
      }
    });
  };

  const handleBringToFront = (id: string) => {
    const maxZ = elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 10);
    const target = elements.find((el) => el.id === id);
    if (target) {
      session.upsertElement({
        ...target,
        zIndex: maxZ + 1,
      });
    }
  };

  const resetView = () => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setPan({ x: clientWidth / 2, y: clientHeight / 2 });
      setZoom(1);
    }
  };

  const adjustZoom = (delta: number) => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const centerX = clientWidth / 2;
    const centerY = clientHeight / 2;

    const newZoom = Math.min(Math.max(zoom + delta, 0.2), 3.5);
    const newPanX = centerX - (centerX - pan.x) * (newZoom / zoom);
    const newPanY = centerY - (centerY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Filter elements
  const paths = elements.filter((el): el is FreehandPath => el.type === 'path');
  const stickyNotes = elements.filter((el): el is StickyNoteType => el.type === 'sticky');

  return (
    <div
      ref={containerRef}
      id="whiteboard-canvas-container"
      className="relative w-full h-full flex-grow overflow-hidden select-none bg-slate-50 cursor-default"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.2px, transparent 1.2px)',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor:
          isPanning || spacePressedRef.current
            ? 'grab'
            : activeTool === 'pen'
            ? 'crosshair'
            : activeTool === 'eraser'
            ? 'cell'
            : 'default',
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* Transformed Infinite Space Container */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none transform-gpu origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG layer for Freehand Paths */}
        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
          {paths.map((p) => (
            <path
              key={p.id}
              d={getSvgPathFromPoints(p.points)}
              stroke={p.color}
              strokeWidth={p.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={activeTool === 'eraser' ? 'pointer-events-auto hover:opacity-50 cursor-pointer' : ''}
              onClick={(e) => {
                if (activeTool === 'eraser') {
                  e.stopPropagation();
                  session.removeElement(p.id);
                }
              }}
            />
          ))}

          {/* Current In-Progress Stroke */}
          {currentStroke && (
            <path
              d={getSvgPathFromPoints(currentStroke)}
              stroke={penColor}
              strokeWidth={penWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          )}
        </svg>

        {/* Sticky Notes Container */}
        <div className="absolute top-0 left-0 pointer-events-auto">
          {stickyNotes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              zoom={zoom}
              onUpdate={(updated) => session.upsertElement(updated)}
              onDelete={(id) => session.removeElement(id)}
              onBringToFront={handleBringToFront}
              readOnly={activeTool === 'eraser'}
            />
          ))}
        </div>

        {/* Multi-Cursor Awareness Layer */}
        {peers.map((peer) => {
          const u = peer.user;
          if (!u || !u.cursor) return null;
          return (
            <div
              key={peer.clientId}
              className="absolute pointer-events-none transition-transform duration-75 ease-out"
              style={{
                left: `${u.cursor.x}px`,
                top: `${u.cursor.y}px`,
                transform: 'translate(-2px, -2px)',
                zIndex: 9999,
              }}
            >
              {/* Cursor Pointer */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-md"
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                  fill={u.color || '#3B82F6'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Name Tag Pill */}
              <div
                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-md ml-3 -mt-2 whitespace-nowrap"
                style={{ backgroundColor: u.color || '#3B82F6' }}
              >
                {u.name || 'Collaborator'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Left Vertical Floating Toolbar (Vibrant Palette Theme) */}
      <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 p-2 sm:p-3 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 z-40">
        {/* Pan / Move */}
        <button
          id="tool-select-btn"
          type="button"
          onClick={() => onSelectTool('select')}
          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl transition ${
            activeTool === 'select'
              ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500 shadow-xs'
              : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
          }`}
          title="Pan / Move Canvas (Space + Drag)"
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Draw / Pen */}
        <div className="relative">
          <button
            id="tool-pen-btn"
            type="button"
            onClick={() => onSelectTool('pen')}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl transition ${
              activeTool === 'pen'
                ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500 shadow-xs'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
            }`}
            title="Pen / Freehand Drawing"
          >
            <Pencil className="w-5 h-5" />
          </button>

          {/* Pen options flyout palette when pen is active */}
          {activeTool === 'pen' && (
            <div className="absolute left-14 sm:left-16 top-0 flex items-center gap-3 px-3.5 py-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 whitespace-nowrap z-50 animate-in fade-in slide-in-from-left-2">
              {/* Color swatches */}
              <div className="flex items-center gap-1.5">
                {STROKE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPenColor(color)}
                    className={`w-5 h-5 rounded-full border transition hover:scale-110 ${
                      penColor === color ? 'ring-2 ring-indigo-500 scale-110 border-white' : 'border-black/10'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="w-[1px] h-5 bg-slate-200" />

              {/* Stroke Widths */}
              <div className="flex items-center gap-1">
                {STROKE_WIDTHS.map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => setPenWidth(width)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition ${
                      penWidth === width ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {width === 2 ? 'Fine' : width === 4 ? 'Med' : 'Bold'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Eraser */}
        <button
          id="tool-eraser-btn"
          type="button"
          onClick={() => onSelectTool('eraser')}
          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl transition ${
            activeTool === 'eraser'
              ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500 shadow-xs'
              : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
          }`}
          title="Eraser (Click or drag over strokes)"
        >
          <Eraser className="w-5 h-5" />
        </button>

        {/* Add Sticky Note */}
        <button
          id="add-sticky-btn"
          type="button"
          onClick={onAddSticky}
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-amber-100 text-amber-700 hover:bg-amber-200/90 shadow-xs transition"
          title="Add Sticky Note"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="h-[1px] bg-slate-200 mx-1.5 my-0.5" />

        {/* Reset View */}
        <button
          id="reset-view-btn"
          type="button"
          onClick={resetView}
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 transition"
          title="Reset View"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Export Canvas */}
        <button
          id="export-canvas-btn"
          type="button"
          onClick={onExportImage}
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 transition"
          title="Export Canvas PNG"
        >
          <Download className="w-5 h-5" />
        </button>

        <div className="h-[1px] bg-slate-200 mx-1.5 my-0.5" />

        {/* Clear Board */}
        <button
          id="clear-board-btn"
          type="button"
          onClick={onClearBoard}
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition"
          title="Clear Whiteboard"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Right Floating Context Cards (Session & Identity) */}
      <div className="absolute right-6 top-6 flex flex-col gap-3.5 z-40 hidden lg:flex">
        {/* Session Card */}
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-slate-100 shadow-xl w-56">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Session Info</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Status</span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              P2P Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Peers Connected</span>
            <span className="text-xs font-bold text-slate-800 font-mono">
              {peers.length} {peers.length === 1 ? 'Peer' : 'Peers'}
            </span>
          </div>
        </div>

        {/* Identity Card */}
        <div
          onClick={onEditIdentity}
          className="bg-white/90 backdrop-blur-md p-4 rounded-3xl border border-slate-100 shadow-xl w-56 cursor-pointer hover:border-indigo-300 transition"
          title="Click to edit your identity"
        >
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identity</h3>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-xs"
              style={{ backgroundColor: userColor }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 font-medium">Local Peer (Odia)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom Controls (Bottom Left) */}
      <div className="absolute bottom-6 left-4 sm:left-6 flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 shadow-xl z-40 text-xs font-semibold text-slate-700">
        <button
          type="button"
          onClick={() => adjustZoom(-0.15)}
          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="font-mono px-2 text-xs w-12 text-center font-bold">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => adjustZoom(0.15)}
          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-xl transition"
          title="Center Canvas View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Connection Status & IndexedDB (Bottom Right) */}
      <div className="absolute bottom-6 right-6 hidden sm:flex items-center gap-2 bg-indigo-600/10 text-indigo-700 px-4 py-2 rounded-2xl border border-indigo-100/60 backdrop-blur-md shadow-xs text-xs font-bold">
        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
        <span>Synced with IndexedDB</span>
      </div>
    </div>
  );
};

