export const ODIA_DEFAULT_NAMES: string[] = [
  'Raju', 'Jaga', 'Hari', 'Kalia', 'Bulu',
  'Chandan', 'Bapi', 'Pintu', 'Tiki', 'Mitu',
  'Lipun', 'Rakesh', 'Sanjay', 'Subash', 'Manas',
  'Rupa', 'Pooja', 'Ipsita', 'Mamata', 'Barsha'
];

export const PEER_COLORS: string[] = [
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316'
];

export interface UserIdentity {
  id: string;
  name: string;
  color: string;
}

export function getOrSetUserIdentity(): UserIdentity {
  let storedName = localStorage.getItem('p2p_whiteboard_username');
  let storedColor = localStorage.getItem('p2p_whiteboard_usercolor');
  let peerId = localStorage.getItem('p2p_whiteboard_peerid');

  if (!storedName) {
    storedName = ODIA_DEFAULT_NAMES[Math.floor(Math.random() * ODIA_DEFAULT_NAMES.length)];
    localStorage.setItem('p2p_whiteboard_username', storedName);
  }
  if (!storedColor) {
    storedColor = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
    localStorage.setItem('p2p_whiteboard_usercolor', storedColor);
  }
  if (!peerId) {
    peerId = Math.random().toString(36).substring(2, 11);
    localStorage.setItem('p2p_whiteboard_peerid', peerId);
  }

  return { id: peerId, name: storedName, color: storedColor };
}

export function saveUserName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem('p2p_whiteboard_username', trimmed);
  }
}

export function saveUserColor(color: string): void {
  localStorage.setItem('p2p_whiteboard_usercolor', color);
}
