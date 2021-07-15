"use strict";

import { g_config } from "./player.js";
import { assert } from "../assert.js";
import { streamToBuffer } from "@jorgeferrero/stream-to-buffer";

function createPlayerFromFile(file) {
  const byteLength = file.length;
  assert(byteLength && byteLength > 0, "invalid file size");

  let readRequest = async (pos, max_read_n) => {
    console.log(`read_cb req: ${pos}, ${pos + max_read_n}-1`);
    const fst = file.createReadStream({
      start: pos,
      end: pos + max_read_n - 1, // inclusive
    });
    const view = await streamToBuffer(fst);
    return view.buffer;
  };

  g_config.createPlayer({
    byteLength,
    readRequest,
  });
}

async function initWebtorrentPlayer(torrentId) {
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
    createPlayerFromFile(choosen_file);
  });

  client.on("error", (err) => {
    console.error(err);
    throw err;
  });
}

export default initWebtorrentPlayer;
