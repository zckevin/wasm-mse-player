"use strict";

import { g_config } from "./player.js";
import { assert } from "./assert.js";
import { streamToBuffer } from "@jorgeferrero/stream-to-buffer";

function runPlayer(file) {
  const fileSize = file.length;
  assert(fileSize && fileSize > 0, "invalid file size");

  let readRequest = async (pos, max_read_n) => {
    console.log(`read_cb req: ${pos}, ${pos + max_read_n}-1`);
    const fst = file.createReadStream({
      start: pos,
      end: pos + max_read_n - 1, // inclusive
    });
    const view = await streamToBuffer(fst);
    return view.buffer;
  };

  let player = new WasmMsePlayer(
    fileSize,
    readRequest,
    g_config.onFragment,
    g_config.onFFmpegMsgCallback
  );
  player.run();
  g_player = player;
}

async function runWebttorrentPlayer(torrentId) {
  // function from web script in html
  assert(createWebtorrentClient, "createWebtorrentClient() is not loaded");
  const client = await createWebtorrentClient(torrentId);
  client.on("torrent", (torrent) => {
    let max_size = 0;
    let choosen_file = null;
    torrent.files.forEach((file) => {
      if (file.length > max_size) {
        max_size = file.length;
        choosen_file = file;
      }
    });
    assert(choosen_file, "no file is choosen");
    runPlayer(choosen_file);
  });

  client.on("error", (err) => {
    console.error(err);
    throw err;
  });
}
