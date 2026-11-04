function createCommunityVoice({ api }) {
  const peerConnectionTimeout = 15_000;
  const element = suffix => document.getElementById(`community-voice${suffix}`);
  const panel = element("");
  const joinButton = element("-join");
  const muteButton = element("-mute");
  const leaveButton = element("-leave");
  const listenButton = element("-listen");
  const status = element("-status");
  const memberList = element("-members");
  const audioOutput = element("-audio");
  const supported = window.isSecureContext && typeof RTCPeerConnection === "function"
    && typeof navigator.mediaDevices?.getUserMedia === "function";
  const retryable = error => !error.status || error.status === 429 || error.status >= 500;
  let session = null;
  let active = null;
  let serverJoin = null;
  let notice = "";
  let memberSnapshot = "";

  function render() {
    const ended = !session || Date.parse(session.endsAt) <= Date.now();
    const call = active;
    const connected = Boolean(call?.joined);
    panel.hidden = !session;
    panel.dataset.state = connected ? "connected" : call ? "connecting" : "idle";
    joinButton.hidden = connected;
    joinButton.disabled = !supported || ended || !session?.joined || Boolean(call || serverJoin);
    muteButton.hidden = !connected;
    muteButton.setAttribute("aria-pressed", String(Boolean(call?.muted)));
    leaveButton.hidden = !call;
    leaveButton.textContent = connected ? "Leave voice" : "Cancel voice join";
    const peers = call ? [...call.peers.values()] : [];
    listenButton.hidden = !peers.some(peer => peer.playbackBlocked);
    const rows = (call?.participants || []).map(member => {
      const self = member.peerId === call.peerId;
      const muted = self ? call.muted : member.muted;
      const peer = call.peers.get(member.peerId);
      const state = peer?.connection.connectionState;
      const detail = peer?.unavailable || state === "failed" ? "Couldn’t connect"
        : peer && state !== "connected" ? "Connecting" : muted ? "Muted" : "Mic on";
      return { name: `${member.username}${self ? " (you)" : ""}`, muted, detail };
    });
    const snapshot = JSON.stringify(rows);
    if (snapshot !== memberSnapshot) {
      memberSnapshot = snapshot;
      memberList.replaceChildren(...rows.map(({ name, muted, detail }) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        const state = document.createElement("small");
        item.dataset.muted = String(muted);
        label.textContent = name;
        state.textContent = detail;
        item.append(label, state);
        return item;
      }));
    }
    memberList.hidden = !rows.length;

    let message = "Join voice to talk while the timer runs.";
    if (ended) message = "Voice closes when the study session ends.";
    else if (!session.joined) message = "Join the study session first to use voice.";
    else if (!supported) message = "Voice needs a browser with microphone access on a secure connection.";
    else if (notice) message = notice;
    else if (call && !connected) message = "Waiting for microphone access and joining voice…";
    else if (!call && serverJoin) message = "Finishing the previous voice connection…";
    else if (connected) {
      const microphone = call.muted ? "Microphone muted." : "Microphone on.";
      if (call.reconnecting) message = `Reconnecting to the voice room. ${microphone}`;
      else if (!peers.length) message = `You’re in voice. Waiting for other students. ${microphone}`;
      else if (peers.some(peer => peer.connection.connectionState === "connected")) message = `Voice connected. ${microphone}`;
      else if (peers.every(peer => peer.unavailable || peer.connection.connectionState === "failed")) message = `Audio couldn’t connect. Leave voice and join again to retry. ${microphone}`;
      else message = `Connecting audio to other students. ${microphone}`;
    }
    if (status.textContent !== message) status.textContent = message;
  }

  function voiceRequest(call, operation, input = {}) {
    return api(`/library/${call.sessionId}/voice/${operation}`, "POST", { peerId: call.peerId, ...input });
  }

  function removePeer(call, peerId) {
    const peer = call.peers.get(peerId);
    if (!peer) return;
    call.peers.delete(peerId);
    clearTimeout(peer.connectTimer);
    peer.connection.close();
    peer.audio.pause();
    peer.audio.srcObject = null;
    peer.audio.remove();
  }

  function release(call, background = false) {
    if (!call.requested) return;
    if (background && typeof navigator.sendBeacon === "function") {
      const body = new Blob([JSON.stringify({ peerId: call.peerId })], { type: "application/json" });
      if (navigator.sendBeacon(`/api/community/library/${call.sessionId}/voice/leave`, body)) return;
    }
    voiceRequest(call, "leave").catch(() => {});
  }

  function leave(message = "", background = false) {
    const call = active;
    active = null;
    notice = message;
    if (call) {
      clearTimeout(call.pollTimer);
      clearTimeout(call.endTimer);
      for (const track of call.stream?.getTracks() || []) track.stop();
      for (const peerId of call.peers.keys()) removePeer(call, peerId);
      release(call, background);
    }
    render();
  }

  function setSession(next) {
    const changed = next?.id !== session?.id;
    session = next;
    if (changed || (active && (!next?.joined || Date.parse(next.endsAt) <= Date.now()))) leave();
    else render();
  }

  function isCurrent(call, peer) {
    return active === call && (!peer || call.peers.get(peer.id) === peer);
  }

  function signal(call, peer, data) {
    peer.outgoing = peer.outgoing.then(async () => {
      if (!isCurrent(call, peer)) return;
      try {
        await voiceRequest(call, "signal", { toPeerId: peer.id, ...data });
      } catch (error) {
        if (!isCurrent(call, peer) || error.status === 404) return;
        if (retryable(error)) await voiceRequest(call, "signal", { toPeerId: peer.id, ...data });
        else throw error;
      }
    }).catch(error => {
      if (isCurrent(call, peer) && error.status !== 404) {
        peer.unavailable = true;
        render();
      }
    });
  }

  function publishDescription(call, peer) {
    const { type, sdp } = peer.connection.localDescription;
    signal(call, peer, { description: { type, sdp } });
    peer.descriptionSent = true;
    for (const candidate of peer.localCandidates.splice(0)) signal(call, peer, { candidate });
  }

  async function offer(call, peer, restart = false) {
    const connection = peer.connection;
    if (!isCurrent(call, peer) || peer.offering || connection.signalingState !== "stable") return;
    peer.offering = true;
    peer.descriptionSent = false;
    try {
      const description = await connection.createOffer({ iceRestart: restart });
      if (!isCurrent(call, peer)) return;
      await connection.setLocalDescription(description);
      if (isCurrent(call, peer)) publishDescription(call, peer);
    } catch {
      if (isCurrent(call, peer)) peer.unavailable = true;
    } finally {
      peer.offering = false;
      if (isCurrent(call, peer)) render();
    }
  }

  async function play(call, peer) {
    try {
      await peer.audio.play();
      peer.playbackBlocked = false;
    } catch (error) {
      peer.playbackBlocked = error.name === "NotAllowedError";
    }
    if (isCurrent(call, peer)) render();
  }

  function watchPeerConnection(call, peer) {
    if (peer.connectTimer) return;
    peer.connectTimer = setTimeout(() => {
      peer.connectTimer = null;
      if (!isCurrent(call, peer) || peer.connection.connectionState === "connected") return;
      peer.unavailable = true;
      render();
    }, peerConnectionTimeout);
  }

  function addPeer(call, peerId) {
    const connection = new RTCPeerConnection();
    try {
      for (const track of call.stream.getAudioTracks()) connection.addTrack(track, call.stream);
    } catch (error) {
      connection.close();
      throw error;
    }
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audioOutput.append(audio);
    const peer = {
      id: peerId, connection, audio, outgoing: Promise.resolve(),
      localCandidates: [], remoteCandidates: [], initiator: call.peerId < peerId,
    };
    call.peers.set(peerId, peer);
    watchPeerConnection(call, peer);

    connection.addEventListener("icecandidate", event => {
      if (!isCurrent(call, peer) || !event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (peer.descriptionSent) signal(call, peer, { candidate });
      else peer.localCandidates.push(candidate);
    });
    connection.addEventListener("track", ({ track }) => {
      if (!isCurrent(call, peer) || track.kind !== "audio") return;
      audio.srcObject = new MediaStream([track]);
      play(call, peer);
    });
    connection.addEventListener("connectionstatechange", () => {
      if (!isCurrent(call, peer)) return;
      if (connection.connectionState === "connected") {
        clearTimeout(peer.connectTimer);
        peer.connectTimer = null;
        peer.unavailable = false;
        peer.restarted = false;
      }
      if (connection.connectionState === "disconnected") watchPeerConnection(call, peer);
      if (connection.connectionState === "failed" && peer.initiator && !peer.restarted) {
        peer.restarted = true;
        offer(call, peer, true);
      }
      render();
    });
    if (peer.initiator) offer(call, peer);
  }

  async function applySignal(call, message) {
    const peer = call.peers.get(message.fromPeerId);
    if (!peer) return;
    const connection = peer.connection;
    try {
      if (message.description) {
        const isOffer = message.description.type === "offer";
        if (isOffer === peer.initiator || connection.signalingState !== (isOffer ? "stable" : "have-local-offer")) return;
        if (peer.receivedDescription === message.description.sdp) return;
        await connection.setRemoteDescription(message.description);
        if (!isCurrent(call, peer)) return;
        peer.receivedDescription = message.description.sdp;
        for (const candidate of peer.remoteCandidates.splice(0)) {
          await connection.addIceCandidate(candidate).catch(() => {});
        }
        if (!isOffer || !isCurrent(call, peer)) return;
        peer.descriptionSent = false;
        await connection.setLocalDescription(await connection.createAnswer());
        if (isCurrent(call, peer)) publishDescription(call, peer);
      } else if (connection.remoteDescription) {
        await connection.addIceCandidate(message.candidate);
      } else if (peer.remoteCandidates.length < 64) {
        peer.remoteCandidates.push(message.candidate);
      }
    } catch {
      if (message.description && isCurrent(call, peer)) peer.unavailable = true;
    }
  }

  async function sync(call) {
    if (!isCurrent(call) || call.polling) return;
    clearTimeout(call.pollTimer);
    call.polling = true;
    try {
      const { participants, signals } = await voiceRequest(call, "sync", { after: call.after, muted: call.muted });
      if (!isCurrent(call)) return;
      call.lastSync = Date.now();
      call.reconnecting = false;
      call.participants = participants;
      const ids = new Set(participants.map(member => member.peerId));
      for (const peerId of call.peers.keys()) if (!ids.has(peerId)) removePeer(call, peerId);
      for (const peerId of ids) {
        if (peerId === call.peerId || call.peers.has(peerId)) continue;
        try {
          addPeer(call, peerId);
        } catch {
          return leave("This browser couldn’t start a voice connection. Join voice to try again.");
        }
      }
      for (const message of signals) {
        if (!isCurrent(call)) return;
        await applySignal(call, message);
        call.after = message.id;
      }
    } catch (error) {
      if (!isCurrent(call)) return;
      if (!retryable(error)) return leave(error.message);
      if (Date.now() - call.lastSync >= 20_000) return leave("The voice connection was lost. Join voice to try again.");
      call.reconnecting = true;
    } finally {
      call.polling = false;
      if (isCurrent(call)) {
        render();
        call.pollTimer = setTimeout(() => sync(call), call.reconnecting ? 2000 : 1000);
      }
    }
  }

  async function join() {
    if (joinButton.disabled || active) return;
    const call = { sessionId: session.id, peerId: crypto.randomUUID(), peers: new Map(), after: 0, muted: false };
    active = call;
    notice = "";
    call.endTimer = setTimeout(() => leave(), Math.max(0, Date.parse(session.endsAt) - Date.now()));
    render();
    try {
      call.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!isCurrent(call)) {
        for (const track of call.stream.getTracks()) track.stop();
        return;
      }
      for (const track of call.stream.getAudioTracks()) {
        track.addEventListener("ended", () => {
          if (isCurrent(call)) leave("The microphone disconnected. Join voice to try again.");
        });
      }
      call.requested = true;
      serverJoin = call;
      const { participants } = await voiceRequest(call, "join");
      if (!isCurrent(call)) return release(call);
      call.joined = true;
      call.participants = participants;
      call.lastSync = Date.now();
      const focusMute = document.activeElement === leaveButton || document.activeElement === document.body;
      render();
      if (focusMute) muteButton.focus({ preventScroll: true });
      sync(call);
    } catch (error) {
      if (!isCurrent(call)) return;
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        leave("Allow microphone access in your browser, then try joining voice again.");
      } else if (error.name === "NotFoundError" || error.name === "NotReadableError") {
        leave("Your microphone is unavailable. Check your audio device, then try again.");
      } else {
        leave(call.requested ? error.message : "Voice couldn’t open your microphone. Try again.");
      }
    } finally {
      if (serverJoin === call) {
        serverJoin = null;
        render();
      }
    }
  }

  joinButton.addEventListener("click", join);
  muteButton.addEventListener("click", () => {
    if (!active?.joined) return;
    active.muted = !active.muted;
    for (const track of active.stream.getAudioTracks()) track.enabled = !active.muted;
    render();
    sync(active);
  });
  leaveButton.addEventListener("click", () => {
    leave();
    if (!joinButton.disabled) joinButton.focus({ preventScroll: true });
  });
  listenButton.addEventListener("click", () => {
    const call = active;
    if (!call) return;
    for (const peer of call.peers.values()) if (peer.playbackBlocked) play(call, peer);
  });
  window.addEventListener("pagehide", () => leave("", true));
  render();
  return { setSession, leave };
}
