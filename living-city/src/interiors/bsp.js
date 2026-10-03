import { createRNG } from '../core/rng.js';

export function createBSPTree(seed, width = 40, depth = 40, minRoomSize = 8, maxDepth = 4) {
  const rng = createRNG(seed);

  const root = {
    x: -width / 2,
    z: -depth / 2,
    w: width,
    d: depth,
    type: 'lobby',
    children: []
  };

  const roomTypes = ['office', 'meeting_room', 'break_room', 'server_room', 'utility'];

  function splitNode(node, currentDepth) {
    if (currentDepth >= maxDepth) return;

    // Decide split direction (horizontal or vertical)
    const canSplitV = node.w >= minRoomSize * 2;
    const canSplitH = node.d >= minRoomSize * 2;

    if (!canSplitV && !canSplitH) return;

    let splitVertical = false;
    if (canSplitV && canSplitH) {
      splitVertical = node.w > node.d ? true : rng.next() > 0.5;
    } else if (canSplitV) {
      splitVertical = true;
    } else {
      splitVertical = false;
    }

    if (splitVertical) {
      const splitRatio = rng.nextFloat(0.4, 0.6);
      const splitW = Math.round(node.w * splitRatio);
      const childA = {
        x: node.x,
        z: node.z,
        w: splitW,
        d: node.d,
        type: currentDepth === 0 ? 'lobby' : rng.choice(roomTypes),
        doorway: {
          x: node.x + splitW,
          z: node.z + node.d / 2,
          orientation: 'vertical'
        },
        children: []
      };
      const childB = {
        x: node.x + splitW,
        z: node.z,
        w: node.w - splitW,
        d: node.d,
        type: rng.choice(roomTypes),
        doorway: null,
        children: []
      };
      node.children = [childA, childB];
      splitNode(childA, currentDepth + 1);
      splitNode(childB, currentDepth + 1);
    } else {
      const splitRatio = rng.nextFloat(0.4, 0.6);
      const splitD = Math.round(node.d * splitRatio);
      const childA = {
        x: node.x,
        z: node.z,
        w: node.w,
        d: splitD,
        type: currentDepth === 0 ? 'lobby' : rng.choice(roomTypes),
        doorway: {
          x: node.x + node.w / 2,
          z: node.z + splitD,
          orientation: 'horizontal'
        },
        children: []
      };
      const childB = {
        x: node.x,
        z: node.z + splitD,
        w: node.w,
        d: node.d - splitD,
        type: rng.choice(roomTypes),
        doorway: null,
        children: []
      };
      node.children = [childA, childB];
      splitNode(childA, currentDepth + 1);
      splitNode(childB, currentDepth + 1);
    }
  }

  splitNode(root, 0);

  // Collect leaf rooms
  const leaves = [];
  function collectLeaves(node) {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      node.children.forEach(collectLeaves);
    }
  }
  collectLeaves(root);

  return {
    root,
    leaves
  };
}
