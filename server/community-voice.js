const voiceLimit = 6;
const leaseDuration = 45_000;
const pendingPerSender = 32;
const deliveryLimit = 32;
const peerIdPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function peerId(value) {
  if (typeof value !== "string" || !peerIdPattern.test(value)) fail(400, "Choose a valid voice connection.");
  return value.toLowerCase();
}

function parseSignal(input) {
  const { description, candidate } = input;
  if (description !== undefined && candidate === undefined) {
    const { type, sdp } = description ?? {};
    if (["offer", "answer"].includes(type) && typeof sdp === "string" && sdp.length <= 16_384 && /^v=0\r?\n/.test(sdp)) {
      return { description: { type, sdp } };
    }
  }
  if (candidate !== undefined && description === undefined) {
    const { candidate: value, sdpMid = null, sdpMLineIndex = null, usernameFragment = null } = candidate ?? {};
    if (typeof value === "string" && value.length <= 2048 && (value === "" || /^candidate:[^\r\n]+$/.test(value)) &&
        (sdpMid === null || (typeof sdpMid === "string" && sdpMid.length <= 64)) &&
        (sdpMLineIndex === null || (Number.isInteger(sdpMLineIndex) && sdpMLineIndex >= 0 && sdpMLineIndex <= 65_535)) &&
        (usernameFragment === null || (typeof usernameFragment === "string" && usernameFragment.length <= 256))) {
      return { candidate: { candidate: value, sdpMid, sdpMLineIndex, usernameFragment } };
    }
  }
  fail(400, "Choose a valid voice signal.");
}

function createCommunityVoice({ now = Date.now } = {}) {
  const rooms = new Map();
  const retiredPeers = new Map();
  let nextSignalId = 1;

  function removePeer(roomId, room, id) {
    if (!room.peers.delete(id)) return;
    // A delayed retry must not replace a student's newer connection.
    retiredPeers.set(id, now() + leaseDuration);
    for (const peer of room.peers.values()) {
      peer.signals = peer.signals.filter(signal => signal.fromPeerId !== id);
    }
    if (!room.peers.size) rooms.delete(roomId);
  }

  function activeRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const clock = now();
    if (room.endsAt <= clock) {
      rooms.delete(roomId);
      return;
    }
    for (const [id, peer] of room.peers) {
      if (peer.expiresAt <= clock) removePeer(roomId, room, id);
    }
    return rooms.get(roomId);
  }

  const cleanup = setInterval(() => {
    for (const roomId of rooms.keys()) activeRoom(roomId);
    const clock = now();
    for (const [id, expiresAt] of retiredPeers) {
      if (expiresAt <= clock) retiredPeers.delete(id);
    }
  }, 15_000);
  cleanup.unref();

  function members(room) {
    return Array.from(room.peers.values(), ({ id, username, muted }) => ({ peerId: id, username, muted }));
  }

  function ownedPeer(room, id, userId, authKey) {
    const peer = room?.peers.get(id);
    return peer?.userId === userId && peer.authKey === authKey ? peer : null;
  }

  function removeMembership(roomId, userId) {
    const room = activeRoom(roomId);
    if (!room) return;
    for (const [id, peer] of room.peers) {
      if (peer.userId === userId) removePeer(roomId, room, id);
    }
  }

  function join(roomId, input, user, authKey, endsAt) {
    const id = peerId(input?.peerId);
    const existing = activeRoom(roomId);
    const current = ownedPeer(existing, id, user.id, authKey);
    if (current) {
      current.expiresAt = now() + leaseDuration;
      return { participants: members(existing), signals: [] };
    }
    if (existing?.peers.has(id) || retiredPeers.get(id) > now()) {
      fail(409, "Choose a new voice connection and try again.");
    }
    if (existing?.peers.size >= voiceLimit && !Array.from(existing.peers.values()).some(peer => peer.userId === user.id)) {
      fail(409, "This voice room already has six students.");
    }
    for (const otherRoomId of rooms.keys()) removeMembership(otherRoomId, user.id);
    const room = rooms.get(roomId) || { endsAt: Date.parse(endsAt), peers: new Map() };
    room.peers.set(id, { id, userId: user.id, username: user.username, authKey, muted: true, expiresAt: now() + leaseDuration, signals: [] });
    rooms.set(roomId, room);
    return { participants: members(room), signals: [] };
  }

  function sync(roomId, input, userId, authKey) {
    const id = peerId(input?.peerId);
    const { after, muted } = input;
    if (!Number.isSafeInteger(after) || after < 0 || typeof muted !== "boolean") fail(400, "Choose a valid voice update.");
    const room = activeRoom(roomId);
    const peer = ownedPeer(room, id, userId, authKey);
    if (!peer) fail(409, "Your voice connection ended. Join voice again.");
    peer.expiresAt = now() + leaseDuration;
    peer.muted = muted;
    peer.signals = peer.signals.filter(signal => signal.id > after);
    return { participants: members(room), signals: peer.signals.slice(0, deliveryLimit) };
  }

  function signal(roomId, input, userId, authKey) {
    const id = peerId(input?.peerId);
    const targetId = peerId(input.toPeerId);
    if (targetId === id) fail(400, "Choose another student in the voice room.");
    const payload = parseSignal(input);
    const room = activeRoom(roomId);
    if (!ownedPeer(room, id, userId, authKey)) fail(409, "Your voice connection ended. Join voice again.");
    const target = room.peers.get(targetId);
    if (!target) fail(404, "That student left the voice room.");
    if (target.signals.filter(item => item.fromPeerId === id).length >= pendingPerSender) {
      fail(429, "That student’s voice connection is catching up. Try again shortly.");
    }
    target.signals.push({ id: nextSignalId++, fromPeerId: id, ...payload });
    return { ok: true };
  }

  function leave(roomId, input, userId, authKey) {
    const id = peerId(input?.peerId);
    const room = activeRoom(roomId);
    if (ownedPeer(room, id, userId, authKey)) removePeer(roomId, room, id);
    return { ok: true };
  }

  function disconnect(authKey) {
    for (const [roomId, room] of rooms) {
      for (const [id, peer] of room.peers) {
        if (peer.authKey === authKey) removePeer(roomId, room, id);
      }
    }
  }

  return { join, sync, signal, leave, removeMembership, disconnect, close: () => clearInterval(cleanup) };
}

module.exports = { createCommunityVoice };
