"use strict";

import { g_config } from "./player.js";
import { assert } from "../assert.js";

// import WasmMsePlayer from "../wasm-mse-player/bundle.js"
import WasmMsePlayer from "../../../index.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runLocalFilePlayer(videoAb) {
  let readRequest = async (pos, max_read_n) => {
    // add some async to avoid dead lock in atomics.js
    await sleep(1);
    console.log(`read req: ${pos} - ${pos + max_read_n}`);
    return videoAb.slice(pos, pos + max_read_n);
  };

  let player = new WasmMsePlayer(
    videoAb.byteLength,
    readRequest,
    g_config.onFragment,
    g_config.onFFmpegMsgCallback
  );
  player.run();
  g_config.player = player;
}

export default runLocalFilePlayer;
