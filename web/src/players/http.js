"use strict";

import { g_config } from "./player.js";
import { assert } from "../assert.js";

async function runHttpPlayer(videoAddr) {
  let resp = await fetch(videoAddr, { method: "HEAD" });
  let fileSize = resp.headers.get("content-length");
  assert(fileSize && fileSize > 0, "invalid file size from http fetch");

  let readRequest = async (pos, max_read_n) => {
    console.log(`read_cb req: ${pos}, ${pos + max_read_n}-1`);
    let resp = await fetch(videoAddr, {
      headers: {
        range: `bytes=${pos}-${pos + max_read_n - 1}`,
      },
    });
    console.log(resp);
    assert(resp.ok, "response not ok");
    let buf = await resp.arrayBuffer();
    return buf;
  };

  let player = new WasmMsePlayer(
    fileSize,
    readRequest,
    g_config.onFragment,
    g_config.onFFmpegMsgCallback
  );
  player.run();
  g_config.player = player;
}

export default runHttpPlayer;
