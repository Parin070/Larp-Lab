export function createDebugOverlay(renderer) {
  // F3 Full HUD
  const f3Div = document.createElement('div');
  f3Div.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: #00ff00;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    z-index: 9999;
    display: none;
    line-height: 1.5;
    pointer-events: none;
  `;
  document.body.appendChild(f3Div);

  // F4 Telemetry Overlay (minimal stats)
  const f4Div = document.createElement('div');
  f4Div.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.85);
    color: #00ffff;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    z-index: 9999;
    display: none;
    line-height: 1.5;
    pointer-events: none;
    border: 1px solid #00aaaa;
  `;
  document.body.appendChild(f4Div);

  let f3Visible = false;
  let f4Visible = false;
  const fpsHistory = [];
  const FPS_HISTORY_SIZE = 30;

  const onKeyDown = (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      f3Visible = !f3Visible;
      f3Div.style.display = f3Visible ? 'block' : 'none';
    } else if (e.key === 'F4') {
      e.preventDefault();
      f4Visible = !f4Visible;
      f4Div.style.display = f4Visible ? 'block' : 'none';
    }
  };

  window.addEventListener('keydown', onKeyDown);

  return {
    getTelemetry(loadedChunks = 0) {
      const info = renderer.info;
      return {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        loadedChunks
      };
    },
    update(deltaTime, time, cameraPos, extraStats = {}) {
      const info = renderer.info;

      // Smoothed FPS calculation
      const currentFps = 1 / Math.max(0.001, deltaTime);
      fpsHistory.push(currentFps);
      if (fpsHistory.length > FPS_HISTORY_SIZE) {
        fpsHistory.shift();
      }
      const smoothedFps = Math.round(
        fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length
      );

      const hour = Math.floor(time * 24);
      const minute = Math.floor((time * 24 - hour) * 60);
      const isPaused = extraStats.isPaused ? ' [PAUSED]' : '';
      const loadedChunks = extraStats.loadedChunks ?? 1;

      if (f3Visible) {
        f3Div.textContent = `FPS: ${smoothedFps} (${(deltaTime * 1000).toFixed(1)}ms)
Draw Calls: ${info.render.calls}
Triangles: ${info.render.triangles.toLocaleString()}
Geometries: ${info.memory.geometries}
Textures: ${info.memory.textures}
Chunks Loaded: ${loadedChunks}

Camera: (${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)})
Mode: ${extraStats.playerMode || 'FLY'}
Controls: WASD move, Shift fast, Space up/jump, C down, V mode, P pause, [ / ] time
Time: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${(time * 100).toFixed(1)}%)${isPaused}`;
      }

      if (f4Visible) {
        f4Div.textContent = `=== F4 TELEMETRY ===
Draw Calls: ${info.render.calls}
Triangles: ${info.render.triangles.toLocaleString()}
Geometries: ${info.memory.geometries}
Textures: ${info.memory.textures}
Loaded Chunks: ${loadedChunks}
FPS: ${smoothedFps}`;
      }
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      document.body.removeChild(f3Div);
      document.body.removeChild(f4Div);
    }
  };
}
