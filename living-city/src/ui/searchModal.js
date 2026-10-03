import { searchBuildings } from '../world/searchIndex.js';

export function createSearchModal(worldSeed, onSelectWaypoint, onTeleport) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background: #1e1e28;
    border: 2px solid #00ffcc;
    border-radius: 8px;
    width: 480px;
    max-width: 90vw;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 255, 204, 0.2);
    font-family: monospace;
    color: #ffffff;
  `;
  overlay.appendChild(box);

  const title = document.createElement('div');
  title.textContent = '=== CITY DIRECTORY & SEARCH ===';
  title.style.cssText = 'color: #00ffcc; font-size: 16px; font-weight: bold; margin-bottom: 12px;';
  box.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search by address or ID (e.g. Ave, b_0_0)...';
  input.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    background: #0f0f16;
    border: 1px solid #444;
    border-radius: 4px;
    color: #ffffff;
    font-family: monospace;
    font-size: 14px;
    margin-bottom: 16px;
    outline: none;
  `;
  box.appendChild(input);

  const resultsList = document.createElement('div');
  resultsList.style.cssText = 'max-height: 240px; overflow-y: auto; margin-bottom: 12px;';
  box.appendChild(resultsList);

  const hint = document.createElement('div');
  hint.textContent = 'ESC to close. Click result to set Waypoint, or Teleport directly.';
  hint.style.cssText = 'font-size: 11px; color: #888; text-align: center;';
  box.appendChild(hint);

  document.body.appendChild(overlay);

  let isOpen = false;

  function renderResults() {
    resultsList.innerHTML = '';
    const query = input.value.trim();
    if (!query) {
      resultsList.innerHTML = '<div style="color: #666; padding: 8px;">Type to search buildings...</div>';
      return;
    }

    const matches = searchBuildings(worldSeed, query);
    if (matches.length === 0) {
      resultsList.innerHTML = '<div style="color: #ff6666; padding: 8px;">No matching buildings found.</div>';
      return;
    }

    matches.forEach((b) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid #333;
        background: #14141d;
        margin-bottom: 4px;
        border-radius: 4px;
      `;

      const info = document.createElement('div');
      info.innerHTML = `<strong>${b.address}</strong> <span style="color: #888; font-size: 11px;">(${b.id})</span>`;
      item.appendChild(info);

      const actions = document.createElement('div');

      const wpBtn = document.createElement('button');
      wpBtn.textContent = 'Waypoint';
      wpBtn.style.cssText = 'background: #008877; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; margin-right: 6px; font-family: monospace;';
      wpBtn.onclick = () => {
        onSelectWaypoint(b);
        close();
      };
      actions.appendChild(wpBtn);

      const tpBtn = document.createElement('button');
      tpBtn.textContent = 'Teleport';
      tpBtn.style.cssText = 'background: #00cc88; color: black; font-weight: bold; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-family: monospace;';
      tpBtn.onclick = () => {
        onTeleport(b);
        close();
      };
      actions.appendChild(tpBtn);

      item.appendChild(actions);
      resultsList.appendChild(item);
    });
  }

  input.addEventListener('input', renderResults);

  function open() {
    isOpen = true;
    overlay.style.display = 'flex';
    input.value = '';
    renderResults();
    setTimeout(() => input.focus(), 50);
    if (document.exitPointerLock) document.exitPointerLock();
  }

  function close() {
    isOpen = false;
    overlay.style.display = 'none';
  }

  window.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    toggle() {
      if (isOpen) close();
      else open();
    },
    isOpen() {
      return isOpen;
    },
    dispose() {
      document.body.removeChild(overlay);
    }
  };
}
