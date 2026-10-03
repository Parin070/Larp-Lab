export function createInteractionPrompt() {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: #ffffff;
    font-family: monospace;
    font-size: 16px;
    padding: 12px 24px;
    border-radius: 8px;
    border: 2px solid #00ff88;
    z-index: 9998;
    display: none;
    pointer-events: none;
    white-space: nowrap;
  `;
  document.body.appendChild(div);

  return {
    show(message) {
      div.textContent = message;
      div.style.display = 'block';
    },
    hide() {
      div.style.display = 'none';
    },
    dispose() {
      document.body.removeChild(div);
    }
  };
}
