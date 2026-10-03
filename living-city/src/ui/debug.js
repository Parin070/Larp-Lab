export function createDebugOverlay(renderer) {
  const div = document.createElement('div');
  div.style.cssText = `
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
  document.body.appendChild(div);

  let visible = false;
  const fpsHistory = [];
  const FPS_HISTORY_SIZE = 30;

  const onKeyDown = (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      visible = !visible;
      div.style.display = visible ? 'block' : 'none';
    }
  };

  window.addEventListener('keydown', onKeyDown);

  return {
    update(deltaTime, time, cameraPos) {
      if (!visible) return;

      // Smoothed FPS calculation (rolling average)
      const currentFps = 1 / deltaTime;
      fpsHistory.push(currentFps);
      if (fpsHistory.length > FPS_HISTORY_SIZE) {
        fpsHistory.shift();
      }
      const smoothedFps = Math.round(
        fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length
      );

      const info = renderer.info;
      const hour = Math.floor(time * 24);
      const minute = Math.floor((time * 24 - hour) * 60);

      div.textContent = `FPS: ${smoothedFps} (${(deltaTime * 1000).toFixed(1)}ms)
Draw Calls: ${info.render.calls}
Triangles: ${info.render.triangles.toLocaleString()}
Geometries: ${info.memory.geometries}
Textures: ${info.memory.textures}

Camera: (${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)})
Controls: WASD move, Shift fast, Space up, C down
Time: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${(time * 100).toFixed(1)}%)`;
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      document.body.removeChild(div);
    }
  };
}
