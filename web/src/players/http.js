"use strict";

import { g_config } from "./player.js";
import { assert } from "../assert.js";

async function initHttpPlayer(videoAddr) {
  const resp = await fetch(videoAddr, { method: "HEAD" });
  const fileSize = resp.headers.get("content-length");
  assert(fileSize && fileSize > 0, "invalid file size from http fetch");

  const readRequest = async (pos, max_read_n) => {
    console.log(`read_cb req: ${pos}, ${pos + max_read_n}-1`);
    const resp = await fetch(videoAddr, {
      headers: {
        range: `bytes=${pos}-${pos + max_read_n - 1}`,
      },
    });
    console.log(resp);
    assert(resp.ok, "response not ok");
    const buf = await resp.arrayBuffer();
    return buf;
  };

  g_config.createPlayer({
    byteLength: fileSize,
    readRequest,
  });
}

export default initHttpPlayer;
