import React, { useState } from 'react';
import {
  Copy,
  Check,
  Edit2,
  Share2,
  Sparkles,
  Plus,
  ArrowRightLeft,
} from 'lucide-react';
import { PeerState } from '../lib/engine';
import { ODIA_DEFAULT_NAMES, PEER_COLORS } from '../lib/identity';
import { getRoomShareURL } from '../lib/room';

interface NavbarProps {
  roomCode: string;
  userName: string;
  userColor: string;
  peers: PeerState[];
  onUpdateName: (newName: string) => void;
  onUpdateColor: (newColor: string) => void;
  onNewRoom: () => void;
  onJoinRoom: (code: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomCode,
  userName,
  userColor,
  peers,
  onUpdateName,
  onUpdateColor,
  onNewRoom,
  onJoinRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const handleCopyLink = async () => {
    try {
      const shareUrl = getRoomShareURL(roomCode);
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveProfile = () => {
    if (tempName.trim()) {
      onUpdateName(tempName.trim());
    }
    setShowProfileModal(false);
  };

  const handleRandomOdiaName = () => {
    const random = ODIA_DEFAULT_NAMES[Math.floor(Math.random() * ODIA_DEFAULT_NAMES.length)];
    setTempName(random);
  };

  return (
    <nav className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-50 shrink-0 shadow-xs">
      {/* Left: Brand & Room Info */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-xs">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 leading-tight text-sm sm:text-base">P2P Whiteboard</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Room</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs sm:text-sm font-mono font-bold text-indigo-600 border border-slate-200/60">
              {roomCode}
            </span>
            <button
              id="copy-room-link-btn"
              type="button"
              onClick={handleCopyLink}
              className="text-slate-400 hover:text-indigo-600 transition p-0.5"
              title="Copy room invite link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Room Switch actions */}
        <div className="hidden md:flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-200">
          <button
            id="new-room-btn"
            type="button"
            onClick={onNewRoom}
            className="text-xs px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg font-semibold transition"
          >
            New Room
          </button>
          <button
            id="join-room-btn"
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="text-xs px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg font-semibold transition flex items-center gap-1"
          >
            <ArrowRightLeft className="w-3 h-3" />
            Switch
          </button>
        </div>
      </div>

      {/* Right: Peer Avatars & Share Board CTA */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Collaborators cluster */}
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {/* My avatar */}
            <div
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-xs cursor-pointer hover:scale-105 transition"
              style={{ backgroundColor: userColor }}
              title={`You: ${userName} (Click to change)`}
              onClick={() => {
                setTempName(userName);
                setShowProfileModal(true);
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>

            {/* Remote Peers */}
            {peers.slice(0, 3).map((p) => (
              <div
                key={p.clientId}
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-xs"
                style={{ backgroundColor: p.user.color || '#3B82F6' }}
                title={`Peer: ${p.user.name || 'Collaborator'}`}
              >
                {(p.user.name || 'P').charAt(0).toUpperCase()}
              </div>
            ))}

            {peers.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shadow-xs">
                +{peers.length - 3}
              </div>
            )}
          </div>
        </div>

        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />

        {/* Share Board Button */}
        <button
          id="share-board-btn"
          type="button"
          onClick={handleCopyLink}
          className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs sm:text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Share Board</span>
            </>
          )}
        </button>
      </div>

      {/* Odia Identity Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-slate-900">Whiteboard Identity</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your name and cursor color are broadcast peer-to-peer across WebRTC. Defaults to authentic Odia names.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Display Name</label>
              <div className="flex gap-2">
                <input
                  id="username-input"
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={24}
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleRandomOdiaName}
                  className="px-2.5 py-2 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition"
                  title="Pick a random Odia name"
                >
                  Random
                </button>
              </div>
            </div>

            {/* Color choices */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Cursor & Avatar Color</label>
              <div className="flex gap-2 flex-wrap">
                {PEER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onUpdateColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      userColor === c ? 'ring-2 ring-indigo-600 scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                id="save-profile-btn"
                type="button"
                onClick={handleSaveProfile}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition shadow-xs"
              >
                Save Identity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Switch / Join Room</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter any 5-character room code to collaborate with friends.
            </p>

            <div className="mt-4">
              <input
                id="join-room-input"
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. K9X2B"
                maxLength={5}
                className="w-full font-mono uppercase tracking-widest text-center text-lg px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                id="confirm-join-room-btn"
                type="button"
                disabled={joinCodeInput.trim().length !== 5}
                onClick={() => {
                  onJoinRoom(joinCodeInput.trim());
                  setShowJoinModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition shadow-xs"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

