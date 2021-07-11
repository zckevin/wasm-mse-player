"use strict";

import { g_config } from "./player.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initLocalFilePlayer(videoAb) {
  const readRequest = async (pos, max_read_n) => {
    // add some async to avoid dead lock in atomics.js
    await sleep(1);
    console.log(`read req: ${pos} - ${pos + max_read_n}`);
    return videoAb.slice(pos, pos + max_read_n);
  };

  const byteLength = videoAb.byteLength;
  g_config.createPlayer({
    byteLength,
    readRequest,
  });
}

export default initLocalFilePlayer;