import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

export type StickyColor = 'yellow' | 'green' | 'pink' | 'purple' | 'blue';

export interface StickyNote {
  id: string;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  color: StickyColor;
  text: string;
  authorName: string;
  reactions: Record<string, number>;
  zIndex: number;
  updatedAt: number;
}

export interface FreehandPath {
  id: string;
  type: 'path';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  zIndex: number;
  updatedAt: number;
}

export type BoardElement = StickyNote | FreehandPath;

export interface RemotePeerUser {
  peerId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  lastSeen: number;
}

export interface PeerState {
  clientId: number;
  user: RemotePeerUser;
}

export class WhiteboardSession {
  public doc: Y.Doc;
  public provider: WebrtcProvider;
  public idb: IndexeddbPersistence;
  public elementsMap: Y.Map<BoardElement>;
  public awareness: any;
  public roomCode: string;

  constructor(roomCode: string, user: { id: string; name: string; color: string }) {
    this.roomCode = roomCode;
    this.doc = new Y.Doc();

    // Save to local IndexedDB so drawings survive browser reload offline
    this.idb = new IndexeddbPersistence(`gh-board-${roomCode}`, this.doc);

    // Free public community signaling fallbacks
    this.provider = new WebrtcProvider(`gh-p2p-whiteboard-${roomCode}`, this.doc, {
      signaling: [
        'wss://signaling.yjs.dev',
        'wss://y-webrtc-signaling-eu.herokuapp.com',
        'wss://y-webrtc-signaling-us.herokuapp.com',
      ],
      password: null,
    });

    this.elementsMap = this.doc.getMap<BoardElement>('board-elements');
    this.awareness = this.provider.awareness;

    // Set peer identity in awareness
    this.awareness.setLocalStateField('user', {
      peerId: user.id,
      name: user.name,
      color: user.color,
      cursor: null,
      lastSeen: Date.now(),
    });
  }

  public sendCursor(pos: { x: number; y: number } | null) {
    const local = this.awareness.getLocalState()?.user;
    if (local) {
      this.awareness.setLocalStateField('user', {
        ...local,
        cursor: pos,
        lastSeen: Date.now(),
      });
    }
  }

  public updateName(name: string) {
    const local = this.awareness.getLocalState()?.user;
    if (local) {
      this.awareness.setLocalStateField('user', {
        ...local,
        name,
      });
    }
  }

  public updateColor(color: string) {
    const local = this.awareness.getLocalState()?.user;
    if (local) {
      this.awareness.setLocalStateField('user', {
        ...local,
        color,
      });
    }
  }

  public upsertElement(element: BoardElement) {
    this.elementsMap.set(element.id, {
      ...element,
      updatedAt: Date.now(),
    });
  }

  public removeElement(id: string) {
    this.elementsMap.delete(id);
  }

  public clearAll() {
    this.doc.transact(() => {
      this.elementsMap.clear();
    });
  }

  public getAllElements(): BoardElement[] {
    const arr: BoardElement[] = [];
    this.elementsMap.forEach((el) => {
      if (el && el.id) {
        arr.push(el);
      }
    });
    // Sort by zIndex ascending, then by updatedAt
    return arr.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0) || a.updatedAt - b.updatedAt);
  }

  public getPeers(): PeerState[] {
    const states = this.awareness.getStates();
    const myClientId = this.doc.clientID;
    const peers: PeerState[] = [];

    states.forEach((state: any, clientId: number) => {
      if (state && state.user && clientId !== myClientId) {
        peers.push({
          clientId,
          user: state.user,
        });
      }
    });

    return peers;
  }

  public subscribeElements(callback: () => void): () => void {
    const handler = () => {
      callback();
    };
    this.elementsMap.observe(handler);
    return () => {
      this.elementsMap.unobserve(handler);
    };
  }

  public subscribeAwareness(callback: () => void): () => void {
    const handler = () => {
      callback();
    };
    this.awareness.on('change', handler);
    return () => {
      this.awareness.off('change', handler);
    };
  }

  public destroy() {
    try {
      this.provider.destroy();
      this.idb.destroy();
      this.doc.destroy();
    } catch (e) {
      console.error('Error destroying WhiteboardSession:', e);
    }
  }
}
