import { generateQuestPool } from './quests.js';

export function createQuestManager(worldSeed, bus, audio) {
  const quests = generateQuestPool(worldSeed, 8);
  const completedQuestIds = new Set();

  let activeQuest = null;
  let currentStageIndex = 0;
  let timeRemaining = null;
  let playerCash = 150; // Starting cash
  let playerRep = 0;

  let lastTickSecond = 0;

  return {
    getQuests() {
      return quests;
    },

    getAvailableQuests() {
      return quests.filter(q => !completedQuestIds.has(q.id) && (!activeQuest || activeQuest.id !== q.id));
    },

    getActiveQuest() {
      return activeQuest;
    },

    getCurrentStage() {
      if (!activeQuest) return null;
      return activeQuest.stages[currentStageIndex] || null;
    },

    getCurrentStageIndex() {
      return currentStageIndex;
    },

    getTimeRemaining() {
      return timeRemaining;
    },

    getCash() {
      return playerCash;
    },

    getRep() {
      return playerRep;
    },

    isCompleted(questId) {
      return completedQuestIds.has(questId);
    },

    acceptQuest(quest) {
      if (activeQuest) return false;

      activeQuest = quest;
      currentStageIndex = 0;
      timeRemaining = quest.timeLimit;
      lastTickSecond = 0;

      if (audio) audio.playQuestStart();

      if (bus) {
        bus.emit('quest_started', {
          actorId: 'player',
          locationId: quest.id,
          data: {
            questId: quest.id,
            title: quest.title,
            timeLimit: quest.timeLimit,
            stage: quest.stages[0]
          }
        });
      }
      return true;
    },

    advanceStage() {
      if (!activeQuest) return null;

      currentStageIndex++;
      if (audio) audio.playPickup();

      if (currentStageIndex >= activeQuest.stages.length) {
        return this.completeQuest();
      }

      const nextStage = activeQuest.stages[currentStageIndex];
      if (bus) {
        bus.emit('quest_progress', {
          actorId: 'player',
          locationId: activeQuest.id,
          data: {
            questId: activeQuest.id,
            stageIndex: currentStageIndex,
            stage: nextStage
          }
        });
      }
      return { status: 'stage_advanced', stage: nextStage };
    },

    completeQuest() {
      if (!activeQuest) return null;

      const finishedQuest = activeQuest;
      completedQuestIds.add(finishedQuest.id);

      playerCash += finishedQuest.reward.cash;
      playerRep += finishedQuest.reward.rep;

      if (audio) {
        audio.playSuccess();
        audio.playCoin();
      }

      if (bus) {
        bus.emit('quest_completed', {
          actorId: 'player',
          locationId: finishedQuest.id,
          data: {
            questId: finishedQuest.id,
            title: finishedQuest.title,
            reward: finishedQuest.reward,
            newCash: playerCash,
            newRep: playerRep
          }
        });
      }

      activeQuest = null;
      currentStageIndex = 0;
      timeRemaining = null;

      return { status: 'completed', quest: finishedQuest };
    },

    failQuest(reason = 'Time expired') {
      if (!activeQuest) return null;

      const failedQuest = activeQuest;
      if (audio) audio.playQuestFail();

      if (bus) {
        bus.emit('quest_failed', {
          actorId: 'player',
          locationId: failedQuest.id,
          data: {
            questId: failedQuest.id,
            title: failedQuest.title,
            reason
          }
        });
      }

      activeQuest = null;
      currentStageIndex = 0;
      timeRemaining = null;

      return { status: 'failed', quest: failedQuest, reason };
    },

    cancelActiveQuest() {
      if (!activeQuest) return;
      this.failQuest('Quest canceled');
    },

    update(deltaTime) {
      if (!activeQuest) return;

      if (timeRemaining !== null) {
        timeRemaining -= deltaTime;

        // Play warning tick on last 10 seconds
        if (timeRemaining <= 10 && timeRemaining > 0) {
          const sec = Math.ceil(timeRemaining);
          if (sec !== lastTickSecond) {
            lastTickSecond = sec;
            if (audio) audio.playTick();
          }
        }

        if (timeRemaining <= 0) {
          this.failQuest('Time expired');
        }
      }
    },

    serialize() {
      return {
        playerCash,
        playerRep,
        completedQuestIds: Array.from(completedQuestIds),
        activeQuestId: activeQuest ? activeQuest.id : null,
        currentStageIndex,
        timeRemaining
      };
    },

    deserialize(data) {
      if (!data) return;
      if (typeof data.playerCash === 'number') playerCash = data.playerCash;
      if (typeof data.playerRep === 'number') playerRep = data.playerRep;
      if (Array.isArray(data.completedQuestIds)) {
        completedQuestIds.clear();
        data.completedQuestIds.forEach(id => completedQuestIds.add(id));
      }
      if (data.activeQuestId) {
        const found = quests.find(q => q.id === data.activeQuestId);
        if (found) {
          activeQuest = found;
          currentStageIndex = data.currentStageIndex || 0;
          timeRemaining = data.timeRemaining ?? found.timeLimit;
        }
      }
    }
  };
}
