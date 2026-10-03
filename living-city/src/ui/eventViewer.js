export function createEventViewer(eventLog) {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 520px;
    height: 340px;
    max-width: 90vw;
    background: rgba(10, 15, 25, 0.92);
    border: 1px solid #00ff88;
    border-radius: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    color: #e0e0e0;
    font-family: monospace;
    font-size: 12px;
    display: none;
    flex-direction: column;
    z-index: 9999;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(0, 255, 136, 0.15);
    border-bottom: 1px solid #00ff88;
    font-weight: bold;
    color: #00ff88;
  `;
  header.innerHTML = '<span>EVENT LOG STREAM [Press L to Close]</span>';
  panel.appendChild(header);

  // Controls bar
  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; gap: 8px; padding: 6px 12px; background: #0d131f; border-bottom: 1px solid #223;';

  const typeFilter = document.createElement('select');
  typeFilter.style.cssText = 'background: #141c2c; color: white; border: 1px solid #334; border-radius: 3px; padding: 2px 6px; font-family: monospace; font-size: 11px;';
  typeFilter.innerHTML = `
    <option value="ALL">ALL TYPES</option>
    <option value="time_changed">TIME</option>
    <option value="player_mode_changed">PLAYER MODE</option>
    <option value="door_entered">DOOR ENTER</option>
    <option value="door_exited">DOOR EXIT</option>
    <option value="npc_state_changed">NPC STATE</option>
    <option value="chunk_loaded">CHUNK LOAD</option>
    <option value="chunk_unloaded">CHUNK UNLOAD</option>
    <option value="player_teleport">TELEPORT</option>
  `;
  controls.appendChild(typeFilter);

  const actorInput = document.createElement('input');
  actorInput.placeholder = 'Filter actor (e.g. player, npc_)...';
  actorInput.style.cssText = 'flex: 1; background: #141c2c; color: white; border: 1px solid #334; border-radius: 3px; padding: 2px 6px; font-family: monospace; font-size: 11px;';
  controls.appendChild(actorInput);

  panel.appendChild(controls);

  // Stream container
  const stream = document.createElement('div');
  stream.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 12px; line-height: 1.4;';
  panel.appendChild(stream);

  document.body.appendChild(panel);

  let isOpen = false;

  function formatTime(simTime = 0) {
    const hour = Math.floor(simTime * 24);
    const min = Math.floor((simTime * 24 - hour) * 60);
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  function renderEvents() {
    stream.innerHTML = '';
    const selectedType = typeFilter.value;
    const actorQuery = actorInput.value.toLowerCase().trim();

    let events = eventLog.getRecent(100);
    if (selectedType !== 'ALL') {
      events = events.filter((e) => e.type === selectedType);
    }
    if (actorQuery) {
      events = events.filter((e) => e.actorId.toLowerCase().includes(actorQuery));
    }

    events.forEach((e) => {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom: 4px; word-break: break-word; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;';

      const timeTag = `<span style="color: #888;">[${formatTime(e.t)}]</span>`;
      const typeTag = `<span style="color: #00ff88; font-weight: bold;">[${e.type}]</span>`;
      const actorTag = `<span style="color: #33ccff;">${e.actorId}</span>`;
      const locTag = `<span style="color: #ffaa00;">@${e.locationId}</span>`;
      const dataStr = Object.keys(e.data).length > 0 ? `<span style="color: #aaa;">${JSON.stringify(e.data)}</span>` : '';

      row.innerHTML = `${timeTag} ${typeTag} ${actorTag} ${locTag} ${dataStr}`;
      stream.appendChild(row);
    });

    stream.scrollTop = stream.scrollHeight;
  }

  typeFilter.addEventListener('change', renderEvents);
  actorInput.addEventListener('input', renderEvents);

  eventLog.subscribe(() => {
    if (isOpen) {
      renderEvents();
    }
  });

  return {
    toggle() {
      isOpen = !isOpen;
      panel.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) renderEvents();
    },
    isOpen() {
      return isOpen;
    },
    dispose() {
      document.body.removeChild(panel);
    }
  };
}
