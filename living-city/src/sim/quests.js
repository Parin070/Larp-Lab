import { createRNG } from '../core/rng.js';
import { CELL_PITCH } from '../world/city.js';

export const QUEST_TYPES = {
  PIZZA_DELIVERY: 'pizza_delivery',
  LOST_STASH: 'lost_stash',
  DUDE_TAXI: 'dude_taxi',
  BOUNTY_HUNT: 'bounty_hunt',
  CYBER_CTF: 'cyber_ctf'
};

export function generateQuestPool(worldSeed, count = 8) {
  const rng = createRNG(worldSeed + 77777);
  const quests = [];

  const giverTemplates = [
    {
      name: 'Luigi Crust',
      title: '🍕 Speedy Dude Pizza Rush',
      role: 'Master Pizza Dude',
      avatar: '🍕',
      type: QUEST_TYPES.PIZZA_DELIVERY,
      intro: [
        "Yo Dude! The cheese is piping hot and our delivery driver just wiped out on a skateboard!",
        "Sprint over to the front porch at the target address before the pizza gets cold!",
        "Do it fast and there's fresh cash in it for you, Dude!"
      ],
      complete: ["Mamma Mia! Outstanding hustle Dude! Here is your tip!"],
      fail: ["Ah man, the pizza is ice cold. The customer gave us a 1-star review!"]
    },
    {
      name: 'Slick Tony',
      title: '💼 Dude\'s Lost Stash',
      role: 'Alleyway Fixer',
      avatar: '🕶️',
      type: QUEST_TYPES.LOST_STASH,
      intro: [
        "Hey Dude, keep your voice down.",
        "I dropped my high-priority neon briefcase behind a building during the morning rush.",
        "Find it, bring it back, and I'll split the spoils with ya!"
      ],
      complete: ["You found it! You are a legend Dude. Take your cut!"],
      fail: ["Someone else snagged the stash! We blew it Dude!"]
    },
    {
      name: 'Chill Chad',
      title: '🚖 Dude Escort Service',
      role: 'Party Animal',
      avatar: '🛹',
      type: QUEST_TYPES.DUDE_TAXI,
      intro: [
        "What's up Dude! My electric scooter ran out of juice and my crew is waiting across town.",
        "Can you escort me over to the downtown party zone?",
        "Lead the way Dude!"
      ],
      complete: ["We made it in one piece! You're a true bro, here's some party cash!"],
      fail: ["Bummer Dude, the party already ended..."]
    },
    {
      name: 'Officer Dan',
      title: '🎯 Wanted: Shady Dude',
      role: 'City Patrol Officer',
      avatar: '👮',
      type: QUEST_TYPES.BOUNTY_HUNT,
      intro: [
        "Attention Dude! We have a shady pickpocket fleeing through the neighborhood.",
        "He's wearing neon streetwear and heading down the avenue.",
        "Track him down, confront him with [E], and collect the city bounty!"
      ],
      complete: ["Suspect apprehended! Outstanding citizenship Dude. Here's your city bounty!"],
      fail: ["The suspect got away! He slipped into the crowds."]
    },
    {
      name: 'Hacker Neo',
      title: '💾 Rogue Terminal CTF Hack',
      role: 'Cyber Forensics Analyst',
      avatar: '💻',
      type: QUEST_TYPES.CYBER_CTF,
      intro: [
        "Greetings Dude. We detected a rogue data beacon transmitting from a local building.",
        "Infiltrate the location, locate the glowing hacker terminal, and extract the forensic keys.",
        "Clock is ticking, don't let the firewall lock us out!"
      ],
      complete: ["Data packet decoded! Flag captured! High five Dude!"],
      fail: ["Firewall locked us out! Connection terminated."]
    }
  ];

  for (let i = 0; i < count; i++) {
    const template = giverTemplates[i % giverTemplates.length];
    const questSeed = rng.nextInt(1000, 999999);
    const qRng = createRNG(questSeed);

    // Giver location on the grid
    const giverGx = qRng.nextInt(-6, 6);
    const giverGz = qRng.nextInt(-6, 6);
    const giverPos = {
      x: giverGx * CELL_PITCH + CELL_PITCH / 2 + qRng.nextInt(-10, 10),
      z: giverGz * CELL_PITCH + CELL_PITCH / 2 + qRng.nextInt(-10, 10)
    };

    // Target location
    const targetGx = giverGx + qRng.choice([-3, -2, 2, 3, 4]);
    const targetGz = giverGz + qRng.choice([-3, -2, 2, 3, 4]);
    const targetPos = {
      x: targetGx * CELL_PITCH + CELL_PITCH / 2 + qRng.nextInt(-8, 8),
      z: targetGz * CELL_PITCH + CELL_PITCH / 2 + qRng.nextInt(-8, 8)
    };

    const targetAddress = `${Math.abs(targetGx * 100 + targetGz)} Metro Ave`;

    let timeLimit = null;
    let stages = [];

    switch (template.type) {
      case QUEST_TYPES.PIZZA_DELIVERY:
        timeLimit = 65; // 65 seconds
        stages = [
          {
            id: 'pickup_pizza',
            text: `Pick up fresh pizza from ${template.name}`,
            target: { x: giverPos.x, z: giverPos.z },
            prop: 'pizza_box',
            prompt: 'Press [E] to Grab Pizza Box',
            radius: 3.5
          },
          {
            id: 'deliver_pizza',
            text: `Deliver hot pizza to ${targetAddress}`,
            target: { x: targetPos.x, z: targetPos.z },
            prop: 'delivery_marker',
            prompt: 'Press [E] to Deliver Pizza',
            radius: 4.0
          }
        ];
        break;

      case QUEST_TYPES.LOST_STASH:
        timeLimit = 90;
        stages = [
          {
            id: 'find_stash',
            text: `Find neon briefcase near ${targetAddress}`,
            target: { x: targetPos.x, z: targetPos.z },
            prop: 'neon_briefcase',
            prompt: 'Press [E] to Grab Neon Briefcase',
            radius: 3.5
          },
          {
            id: 'return_stash',
            text: `Return briefcase to ${template.name}`,
            target: { x: giverPos.x, z: giverPos.z },
            prop: null,
            prompt: 'Press [E] to Return Stash',
            radius: 3.5
          }
        ];
        break;

      case QUEST_TYPES.DUDE_TAXI:
        timeLimit = 80;
        stages = [
          {
            id: 'escort_dude',
            text: `Guide ${template.name} to ${targetAddress}`,
            target: { x: targetPos.x, z: targetPos.z },
            prop: 'destination_marker',
            prompt: 'Press [E] to Complete Escort',
            radius: 4.0
          }
        ];
        break;

      case QUEST_TYPES.BOUNTY_HUNT:
        timeLimit = 75;
        stages = [
          {
            id: 'catch_suspect',
            text: `Confront runaway suspect near ${targetAddress}`,
            target: { x: targetPos.x, z: targetPos.z },
            prop: 'suspect_marker',
            prompt: 'Press [E] to Tackle Suspect',
            radius: 3.5
          }
        ];
        break;

      case QUEST_TYPES.CYBER_CTF:
        timeLimit = 70;
        stages = [
          {
            id: 'hack_terminal',
            text: `Hack rogue CTF terminal at ${targetAddress}`,
            target: { x: targetPos.x, z: targetPos.z },
            prop: 'hacker_disc',
            prompt: 'Press [E] to Extract Flag Data',
            radius: 3.5
          }
        ];
        break;
    }

    const cashReward = qRng.nextInt(150, 450);
    const repReward = 1;

    quests.push({
      id: `quest_${i}_${questSeed}`,
      seed: questSeed,
      type: template.type,
      title: template.title,
      role: template.role,
      avatar: template.avatar,
      giver: {
        name: template.name,
        avatar: template.avatar,
        role: template.role,
        pos: giverPos
      },
      introDialogue: template.intro,
      completeDialogue: template.complete,
      failDialogue: template.fail,
      reward: {
        cash: cashReward,
        rep: repReward
      },
      timeLimit,
      stages
    });
  }

  return quests;
}
