import React, { useState, useRef, useEffect } from 'react';
import { StickyNote as StickyNoteType, StickyColor } from '../lib/engine';
import { Trash2, GripHorizontal, Smile } from 'lucide-react';

interface StickyNoteProps {
  note: StickyNoteType;
  zoom: number;
  onUpdate: (updated: StickyNoteType) => void;
  onDelete: (id: string) => void;
  onBringToFront: (id: string) => void;
  readOnly?: boolean;
}

const COLOR_CLASSES: Record<StickyColor, { bg: string; border: string; text: string; header: string; tag: string }> = {
  yellow: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    text: 'text-yellow-950',
    header: 'bg-yellow-200/60',
    tag: 'bg-yellow-300/80 text-yellow-900',
  },
  green: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    text: 'text-emerald-950',
    header: 'bg-emerald-200/60',
    tag: 'bg-emerald-300/80 text-emerald-900',
  },
  pink: {
    bg: 'bg-pink-100',
    border: 'border-pink-300',
    text: 'text-pink-950',
    header: 'bg-pink-200/60',
    tag: 'bg-pink-300/80 text-pink-900',
  },
  purple: {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-950',
    header: 'bg-purple-200/60',
    tag: 'bg-purple-300/80 text-purple-900',
  },
  blue: {
    bg: 'bg-sky-100',
    border: 'border-sky-300',
    text: 'text-sky-950',
    header: 'bg-sky-200/60',
    tag: 'bg-sky-300/80 text-sky-900',
  },
};

const AVAILABLE_COLORS: StickyColor[] = ['yellow', 'green', 'pink', 'purple', 'blue'];
const EMOJI_REACTIONS = ['👍', '⭐', '❤️', '🔥', '💡'];

export const StickyNote: React.FC<StickyNoteProps> = ({
  note,
  zoom,
  onUpdate,
  onDelete,
  onBringToFront,
  readOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(note.text);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; origX: number; origY: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalText(note.text);
  }, [note.text]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // If clicking buttons or textarea directly, let them handle it
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.closest('button')) {
      return;
    }

    e.stopPropagation();
    onBringToFront(note.id);

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: note.x,
      origY: note.y,
    };
    setIsDragging(true);

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = (moveEv.clientX - dragStartRef.current.clientX) / zoom;
      const dy = (moveEv.clientY - dragStartRef.current.clientY) / zoom;

      onUpdate({
        ...note,
        x: Math.round(dragStartRef.current.origX + dx),
        y: Math.round(dragStartRef.current.origY + dy),
      });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleReaction = (emoji: string) => {
    const currentReactions = { ...(note.reactions || {}) };
    currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
    onUpdate({
      ...note,
      reactions: currentReactions,
    });
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    if (localText !== note.text) {
      onUpdate({
        ...note,
        text: localText,
      });
    }
  };

  const handleColorChange = (newColor: StickyColor) => {
    setShowColorPicker(false);
    onUpdate({
      ...note,
      color: newColor,
    });
  };

  const theme = COLOR_CLASSES[note.color] || COLOR_CLASSES.yellow;

  return (
    <div
      id={`sticky-${note.id}`}
      className={`absolute rounded-2xl border ${theme.border} ${theme.bg} select-none transition-shadow ${
        isDragging ? 'shadow-2xl opacity-90 cursor-grabbing ring-2 ring-indigo-400' : 'cursor-grab shadow-xl'
      }`}
      style={{
        left: `${note.x}px`,
        top: `${note.y}px`,
        width: `${note.width}px`,
        zIndex: note.zIndex || 10,
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Header bar */}
      <div
        className={`flex items-center justify-between px-3.5 py-2.5 rounded-t-2xl border-b ${theme.border} ${theme.header}`}
      >
        {/* Author pill */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs`}
            style={{ backgroundColor: '#4F46E5' }}
          >
            {note.authorName ? note.authorName.charAt(0).toUpperCase() : 'O'}
          </div>
          <span className="text-xs font-semibold truncate max-w-[95px] opacity-75">
            {note.authorName || 'Collaborator'}
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition">
          <div className="relative">
            <button
              id={`color-btn-${note.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              className="p-1 rounded-md hover:bg-black/5 transition"
              title="Change note color"
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border border-black/20`}
                style={{
                  backgroundColor:
                    note.color === 'yellow'
                      ? '#FDE047'
                      : note.color === 'green'
                      ? '#6EE7B7'
                      : note.color === 'pink'
                      ? '#F472B6'
                      : note.color === 'purple'
                      ? '#C084FC'
                      : '#60A5FA',
                }}
              />
            </button>

            {showColorPicker && (
              <div
                className="absolute right-0 top-7 flex gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {AVAILABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    className={`w-5 h-5 rounded-full border transition hover:scale-110 ${
                      note.color === c ? 'ring-2 ring-slate-900 ring-offset-1' : 'border-slate-300'
                    }`}
                    style={{
                      backgroundColor:
                        c === 'yellow'
                          ? '#FDE047'
                          : c === 'green'
                          ? '#6EE7B7'
                          : c === 'pink'
                          ? '#F472B6'
                          : c === 'purple'
                          ? '#C084FC'
                          : '#60A5FA',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            id={`delete-btn-${note.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="p-1 rounded-md hover:bg-rose-200/50 hover:text-rose-700 transition"
            title="Delete note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="p-0.5 opacity-50 cursor-grab">
            <GripHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Body content */}
      <div className="p-3.5">
        <textarea
          ref={textareaRef}
          value={localText}
          readOnly={readOnly}
          onChange={(e) => setLocalText(e.target.value)}
          onFocus={() => {
            setIsEditing(true);
            onBringToFront(note.id);
          }}
          onBlur={handleTextBlur}
          placeholder="Write note ideas here..."
          rows={4}
          className={`w-full resize-none bg-transparent border-0 outline-none text-sm leading-relaxed ${theme.text} placeholder:opacity-40 font-medium focus:ring-0`}
        />

        {/* Reaction Pill Buttons */}
        <div className="mt-3 pt-2 border-t border-black/5 flex flex-wrap items-center gap-1.5">
          {EMOJI_REACTIONS.map((emoji) => {
            const count = (note.reactions && note.reactions[emoji]) || 0;
            return (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReaction(emoji);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition active:scale-95 ${
                  count > 0
                    ? 'bg-white/80 text-slate-900 shadow-2xs border border-black/10 font-bold'
                    : 'bg-white/40 hover:bg-white/70 text-slate-700'
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
