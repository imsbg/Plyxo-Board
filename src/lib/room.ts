const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  const buffer = new Uint8Array(5);
  crypto.getRandomValues(buffer);
  for (let i = 0; i < 5; i++) {
    code += ALPHABET[buffer[i] % ALPHABET.length];
  }
  return code;
}

export function getRoomFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/i.test(roomParam)) {
    return roomParam.toUpperCase();
  }
  // Check hash fallback: #/K9X2B or #/room/K9X2B
  const hashRaw = window.location.hash.replace(/^#\/?(room\/)?/, '').toUpperCase();
  if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(hashRaw)) {
    return hashRaw;
  }
  return null;
}

export function setRoomURL(roomCode: string): void {
  const cleanCode = roomCode.toUpperCase();
  // We can maintain ?room=CODE which is standard and reload-safe on GitHub Pages when hosted with 404 spa or root
  const url = new URL(window.location.href);
  url.searchParams.set('room', cleanCode);
  window.history.pushState({ room: cleanCode }, '', url.toString());
}

export function getRoomShareURL(roomCode: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode.toUpperCase());
  return url.toString();
}
