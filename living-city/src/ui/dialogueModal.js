export function createDialogueModal(audio) {
  const container = document.createElement('div');
  container.id = 'dialogue-modal';
  container.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 640px;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 2px solid #38bdf8;
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 24px rgba(56, 189, 248, 0.25);
    padding: 20px 24px;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
    display: none;
    z-index: 9999;
    user-select: none;
    pointer-events: auto;
  `;
  document.body.appendChild(container);

  let currentQuest = null;
  let onAcceptCallback = null;
  let onDeclineCallback = null;
  let typeTimer = null;

  function render(quest) {
    currentQuest = quest;
    container.innerHTML = `
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <!-- Avatar Column -->
        <div style="
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          border: 2px solid #38bdf8;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
        ">
          ${quest.avatar || '😎'}
        </div>

        <!-- Content Column -->
        <div style="flex: 1; min-width: 0;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 16px; color: #38bdf8;">${quest.giver.name}</span>
              <span style="font-size: 11px; background: rgba(56, 189, 248, 0.2); color: #7dd3fc; padding: 2px 8px; border-radius: 10px; font-weight: 600;">
                ${quest.role || 'Citizen'}
              </span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #4ade80;">
              💰 $${quest.reward.cash} &nbsp; ⭐ +${quest.reward.rep}
            </div>
          </div>

          <!-- Mission Title -->
          <div style="font-size: 13px; font-weight: 700; color: #fde047; margin-bottom: 8px;">
            ${quest.title} ${quest.timeLimit ? `<span style="color: #f87171; font-weight: 600;">(⏱ ${quest.timeLimit}s)</span>` : ''}
          </div>

          <!-- Dialogue Text with Typewriter -->
          <div id="dialogue-text-body" style="
            font-size: 14px;
            line-height: 1.5;
            color: #e2e8f0;
            min-height: 48px;
            margin-bottom: 14px;
          "></div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="dialogue-decline-btn" style="
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.2);
              color: #94a3b8;
              padding: 8px 16px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s ease;
            ">
              [Esc] Later Dude
            </button>
            <button id="dialogue-accept-btn" style="
              background: linear-gradient(135deg, #10b981, #059669);
              border: none;
              color: #ffffff;
              padding: 8px 20px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
              transition: all 0.15s ease;
            ">
              [E] Accept Mission! 🚀
            </button>
          </div>
        </div>
      </div>
    `;

    // Typewriter effect
    const textEl = container.querySelector('#dialogue-text-body');
    const fullText = quest.introDialogue.join(' ');
    let charIndex = 0;

    if (typeTimer) clearInterval(typeTimer);

    typeTimer = setInterval(() => {
      if (charIndex < fullText.length) {
        textEl.textContent += fullText[charIndex];
        if (charIndex % 3 === 0 && audio) {
          audio.playVoiceBeep(charIndex);
        }
        charIndex++;
      } else {
        clearInterval(typeTimer);
        typeTimer = null;
      }
    }, 18);

    // Event listeners
    container.querySelector('#dialogue-accept-btn').addEventListener('click', () => {
      if (onAcceptCallback) onAcceptCallback(currentQuest);
    });

    container.querySelector('#dialogue-decline-btn').addEventListener('click', () => {
      if (onDeclineCallback) onDeclineCallback();
    });
  }

  return {
    open(quest, onAccept, onDecline) {
      onAcceptCallback = onAccept;
      onDeclineCallback = onDecline;
      render(quest);
      container.style.display = 'block';
    },

    close() {
      if (typeTimer) {
        clearInterval(typeTimer);
        typeTimer = null;
      }
      container.style.display = 'none';
      currentQuest = null;
    },

    isOpen() {
      return container.style.display === 'block';
    },

    getCurrentQuest() {
      return currentQuest;
    },

    accept() {
      if (onAcceptCallback && currentQuest) {
        onAcceptCallback(currentQuest);
      }
    },

    decline() {
      if (onDeclineCallback) {
        onDeclineCallback();
      } else {
        this.close();
      }
    },

    dispose() {
      if (typeTimer) clearInterval(typeTimer);
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  };
}
