export function createHUD(canvas, bus) {
  // Container for all HUD elements
  const container = document.createElement('div');
  container.id = 'game-hud';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", monospace, sans-serif;
    z-index: 9990;
  `;
  document.body.appendChild(container);

  // 1. Center Crosshair / Reticle
  const crosshair = document.createElement('div');
  crosshair.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.8), 0 0 4px #38bdf8;
    transition: transform 0.15s ease, background 0.15s ease;
  `;
  container.appendChild(crosshair);

  // 2. Top Glassmorphism Status Bar
  const topBar = document.createElement('div');
  topBar.style.cssText = `
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 18px;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 30px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    color: #f8fafc;
    font-size: 13px;
    font-weight: 500;
  `;
  container.appendChild(topBar);

  const titleBadge = document.createElement('div');
  titleBadge.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    color: #38bdf8;
    font-weight: 700;
    letter-spacing: 0.5px;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    padding-right: 12px;
  `;
  titleBadge.innerHTML = `<span>🏙️</span> <span>LIVING CITY</span>`;
  topBar.appendChild(titleBadge);

  const timeBadge = document.createElement('div');
  timeBadge.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    color: #fde047;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    padding-right: 12px;
  `;
  timeBadge.innerHTML = `<span id="hud-time-icon">☀️</span> <span id="hud-time-text">12:00 PM</span>`;
  topBar.appendChild(timeBadge);

  const modeBadge = document.createElement('div');
  modeBadge.id = 'hud-mode-badge';
  modeBadge.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.5);
    border-radius: 20px;
    color: #34d399;
    font-size: 12px;
    font-weight: 600;
  `;
  modeBadge.innerHTML = `<span>🚶 WALK [V]</span>`;
  topBar.appendChild(modeBadge);

  const sprintBadge = document.createElement('div');
  sprintBadge.id = 'hud-sprint-badge';
  sprintBadge.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
  `;
  sprintBadge.innerHTML = `<span>⚡ SPRINT [Shift]</span>`;
  topBar.appendChild(sprintBadge);

  // 3. Bottom Controls Guide Bar
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: #94a3b8;
    font-size: 11px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  `;
  bottomBar.innerHTML = `
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #fff;">WASD</kbd> Move</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #fff;">Shift</kbd> Run</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #fff;">Space</kbd> Jump</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #38bdf8;">E</kbd> Enter Building</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #fde047;">K</kbd> Search Address</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #34d399;">V</kbd> Fly / Walk</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #fff;">P</kbd> Pause Time</div>
    <div><kbd style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; color: #fff;">F3</kbd> Stats</div>
  `;
  container.appendChild(bottomBar);

  // 4. Click-to-Play Pointer Lock Overlay
  const startOverlay = document.createElement('div');
  startOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(10, 15, 30, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #ffffff;
    pointer-events: auto;
    cursor: pointer;
    transition: opacity 0.3s ease;
    z-index: 9995;
  `;
  startOverlay.innerHTML = `
    <div style="
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.2);
      border-radius: 16px;
      padding: 32px 48px;
      text-align: center;
      max-width: 520px;
    ">
      <div style="font-size: 32px; font-weight: 800; color: #38bdf8; margin-bottom: 8px; letter-spacing: 1px;">
        LIVING CITY
      </div>
      <div style="font-size: 14px; color: #94a3b8; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px;">
        Low-Poly Procedural Sandbox
      </div>
      <div style="
        display: inline-block;
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: #ffffff;
        font-weight: 700;
        font-size: 16px;
        padding: 14px 32px;
        border-radius: 30px;
        margin-bottom: 20px;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.5);
      ">
        🎮 CLICK ANYWHERE TO PLAY
      </div>
      <div style="font-size: 13px; color: #cbd5e1; line-height: 1.8; text-align: left; background: rgba(0,0,0,0.3); padding: 14px 20px; border-radius: 8px;">
        • <b>WASD</b>: Walk around the streets<br>
        • <b>Mouse</b>: Look around (Pointer Lock)<br>
        • <b>Walk to any door & press [E]</b> to enter interior rooms<br>
        • <b>Press [K]</b> to search any building address and set waypoints<br>
        • <b>Press [V]</b> to toggle between Street Walk and Sky Fly mode
      </div>
    </div>
  `;
  container.appendChild(startOverlay);

  // Click overlay to request pointer lock
  startOverlay.addEventListener('click', () => {
    canvas.requestPointerLock();
  });

  const onPointerLock = () => {
    const isLocked = document.pointerLockElement === canvas;
    if (isLocked) {
      startOverlay.style.opacity = '0';
      startOverlay.style.pointerEvents = 'none';
      crosshair.style.opacity = '1';
    } else {
      startOverlay.style.opacity = '1';
      startOverlay.style.pointerEvents = 'auto';
      crosshair.style.opacity = '0.5';
    }
  };

  document.addEventListener('pointerlockchange', onPointerLock);

  // Format time of day helper
  function formatSimTime(timeFloat) {
    const totalMinutes = Math.floor(timeFloat * 24 * 60);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const padMin = String(minutes).padStart(2, '0');
    let icon = '☀️';
    if (hours24 >= 20 || hours24 < 5) icon = '🌙';
    else if (hours24 >= 5 && hours24 < 8) icon = '🌅';
    else if (hours24 >= 17 && hours24 < 20) icon = '🌇';
    return { icon, text: `${hours12}:${padMin} ${ampm}` };
  }

  const timeIconEl = document.getElementById('hud-time-icon');
  const timeTextEl = document.getElementById('hud-time-text');
  const modeBadgeEl = document.getElementById('hud-mode-badge');
  const sprintBadgeEl = document.getElementById('hud-sprint-badge');

  return {
    update(simTime, mode, isSprinting, isInterior = false) {
      const { icon, text } = formatSimTime(simTime);
      if (timeIconEl) timeIconEl.textContent = icon;
      if (timeTextEl) timeTextEl.textContent = text;

      if (modeBadgeEl) {
        if (isInterior) {
          modeBadgeEl.innerHTML = `<span>🏢 INTERIOR [E Exit]</span>`;
          modeBadgeEl.style.background = 'rgba(245, 158, 11, 0.2)';
          modeBadgeEl.style.borderColor = 'rgba(245, 158, 11, 0.5)';
          modeBadgeEl.style.color = '#fbbf24';
        } else if (mode === 'walk') {
          modeBadgeEl.innerHTML = `<span>🚶 WALK [V]</span>`;
          modeBadgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
          modeBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          modeBadgeEl.style.color = '#34d399';
        } else {
          modeBadgeEl.innerHTML = `<span>🕊️ FLY [V]</span>`;
          modeBadgeEl.style.background = 'rgba(56, 189, 248, 0.2)';
          modeBadgeEl.style.borderColor = 'rgba(56, 189, 248, 0.5)';
          modeBadgeEl.style.color = '#38bdf8';
        }
      }

      if (sprintBadgeEl) {
        if (isSprinting) {
          sprintBadgeEl.style.color = '#fde047';
          sprintBadgeEl.style.fontWeight = '700';
        } else {
          sprintBadgeEl.style.color = 'rgba(255, 255, 255, 0.4)';
          sprintBadgeEl.style.fontWeight = '400';
        }
      }
    },
    dispose() {
      document.removeEventListener('pointerlockchange', onPointerLock);
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  };
}
