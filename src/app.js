import * as Comlink from "comlink";
import { assert, assertNotReached } from "./assert.js";

import WasmMsePlayer from "./index.js";

import { streamToBuffer } from "@jorgeferrero/stream-to-buffer";

/******************************************************/

let fragments = [];
let g_duration = 0;
let g_codec = "";
let g_player = null;

function createMse() {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.width = 480;
    document.body.appendChild(v);
    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener("sourceopen", () => {
      URL.revokeObjectURL(url);
      resolve([v, mediaSource]);
    });
    v.src = url;
  });
}

function serialize_parsing_result_to_view(result) {
  let ab = new ArrayBuffer(result.length);

  // size
  let dv = new DataView(ab);
  dv.setUint32(0, result.length);

  // atom type
  for (let i = 0; i < 4; i++) {
    dv.setUint8(4 + i, result.atom_type[i].charCodeAt(0));
  }

  // atom data
  let view = new Uint8Array(ab);
  view.set(result.data.buf, 8);

  return view;
}

async function run_player() {
  let [v, mediaSource] = await createMse();
  mediaSource.duration = g_duration;
  console.log(g_codec);
  let sb = mediaSource.addSourceBuffer(g_codec);

  function appendBuffer(start, end) {
    let n = 0;
    let views = fragments.splice(start, end).map((parsedResult) => {
      let view = serialize_parsing_result_to_view(parsedResult);
      n += view.byteLength;
      return view;
    });

    let pos = 0;
    let tmp = new Uint8Array(n);
    views.map((view) => {
      tmp.set(view, pos);
      pos += view.byteLength;
    });

    try {
      sb.appendBuffer(tmp);
    } catch (err) {
      console.error("Chrome MSE met err: ", err);
      g_player.stop();
    }
  }

  setInterval(() => {
    if (fragments.length >= 4 && !sb.updating) {
      if (
        fragments[0].atom_type === "ftyp" &&
        fragments[1].atom_type === "moov" &&
        fragments[2].atom_type === "moof" &&
        fragments[3].atom_type === "mdat"
      ) {
        appendBuffer(0, 4);
        console.log("@@append init");
        return;
      }
    }
    if (fragments.length >= 2 && !sb.updating) {
      if (
        fragments[0].atom_type === "moof" &&
        fragments[1].atom_type === "mdat"
      ) {
        appendBuffer(0, 2);
        console.log("@@append a fragment");
        return;
      }
    }
  }, 500);

  v.controls = true;
  v.muted = true; // autoplay only works on muted video
  // v.currentTime = 14.2;
  v.play();
}

/******************************************************/

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

  let onFragment = (fragment) => {
    fragments.push(fragment);
  };

  let onFFmpegMsgCallback = (msg) => {
    console.log("onFFmpegMsg", msg);
    if (msg.cmd == "meta_info") {
      assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
      assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
      alert(JSON.stringify(msg));

      g_duration = msg.duration;
      g_codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;

      run_player();
    }
  };

  let player = new WasmMsePlayer(
    videoAb.byteLength,
    readRequest,
    onFragment,
    onFFmpegMsgCallback
  );
  player.run();
  g_player = player;
}

const fileSelector = document.getElementById("file-selector");
fileSelector.addEventListener("change", (event) => {
  const file = event.target.files.item(0);
  let reader = new FileReader();

  reader.onload = function () {
    runLocalFilePlayer(reader.result);
  };
  reader.readAsArrayBuffer(file);
});

/******************************************************/

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

  let onFragment = (fragment) => {
    fragments.push(fragment);
  };

  let onFFmpegMsgCallback = (msg) => {
    console.log("onFFmpegMsg", msg);
    if (msg.cmd == "meta_info") {
      assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
      assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
      alert(JSON.stringify(msg));

      g_duration = msg.duration;
      g_codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;

      run_player();
    }
  };

  let player = new WasmMsePlayer(
    fileSize,
    readRequest,
    onFragment,
    onFFmpegMsgCallback
  );
  player.run();
  g_player = player;
}

/******************************************************/

async function runWebttorrentPlayer(torrentId) {
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

    let onFragment = (fragment) => {
      fragments.push(fragment);
    };

    let onFFmpegMsgCallback = (msg) => {
      console.log("onFFmpegMsg", msg);
      if (msg.cmd == "meta_info") {
        assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
        assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
        alert(JSON.stringify(msg));

        g_duration = msg.duration;
        g_codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;

        run_player();
      }
    };

    let player = new WasmMsePlayer(
      fileSize,
      readRequest,
      onFragment,
      onFFmpegMsgCallback
    );
    player.run();
    g_player = player;
  }

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

/******************************************************/

const inputElm = document.getElementById("video-addr");
inputElm.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    console.log(inputElm.value);
    // runHttpPlayer(inputElm.value);
    runWebttorrentPlayer(inputElm.value);
  }
});
