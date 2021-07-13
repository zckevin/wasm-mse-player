"use strict";

import { assert } from "../assert.js";
import { SimpleMaxBufferTimeController } from "../../../src/controller.js";
// import WasmMsePlayer from "../wasm-mse-player/bundle.js"
import WasmMsePlayer from "../../../index.js";

let g_config = {
  fragments: [],
  duration: 0,
  codec: "",
  player: null,
  videoElement: null,
  mediaSource: null,
};

function createMse() {
  return new Promise((resolve) => {
    const v = document.getElementsByTagName("video")[0];
    assert(v, "video element not found?");
    // const v = document.createElement("video");
    // v.style.width = "480px";

    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener("sourceopen", () => {
      URL.revokeObjectURL(url);
      resolve([v, mediaSource]);
    });

    v.src = url;
    document.body.appendChild(v);
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

function appendBuffer(sb, start, end) {
  let n = 0;
  let views = g_config.fragments.splice(start, end).map((parsedResult) => {
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
    g_config.player.stop();
  }
}

async function RunPlayer() {
  const v = g_config.videoElement;
  const mediaSource = g_config.mediaSource;

  mediaSource.duration = g_config.duration;
  console.log(g_config.codec);

  const sb = mediaSource.addSourceBuffer(g_config.codec);
  let moovEmitted = false;

  setInterval(() => {
    if (sb.updating) {
      return;
    }
    const fragments = g_config.fragments;
    const matcher = (...args) => {
      let result = true;
      args.map((type, index) => {
        if (type !== fragments[index].atom_type) {
          result = false;
        }
      });
      return result;
    };
    if (!moovEmitted && fragments.length >= 4) {
      if (
        matcher("ftyp", "moov", "moof", "mdat")
        // fragments[0].atom_type === "ftyp" &&
        // fragments[1].atom_type === "moov" &&
        // fragments[2].atom_type === "moof" &&
        // fragments[3].atom_type === "mdat"
      ) {
        appendBuffer(sb, 0, 4);
        console.log("@@append init");
        moovEmitted = true;
        return;
      }
    }
    if (moovEmitted && fragments.length >= 2) {
      if (
        matcher("moof", "mdat")
        // fragments[0].atom_type === "moof" &&
        // fragments[1].atom_type === "mdat"
      ) {
        appendBuffer(sb, 0, 2);
        console.log("@@append a fragment");
        return;
      } else {
        while (!matcher("moof", "mdat")) {
          fragments.shift();
          if (fragments.length < 2) {
            break;
          }
        }
      }
    }
  }, 500);

  v.controls = true;
  v.muted = true; // autoplay only works on muted video
  // v.currentTime = 14.2;
  v.play();
}

g_config.onFragment = (fragment) => {
  g_config.fragments.push(fragment);
};

g_config.onFFmpegMsgCallback = (msg) => {
  console.log("onFFmpegMsg", msg);
  if (msg.cmd == "meta_info") {
    assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
    assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
    // alert(JSON.stringify(msg));
    console.log(JSON.stringify(msg));

    g_config.duration = msg.duration;
    g_config.codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;

    g_config.run_player();
  }
};

g_config.clearMseBuffer = (startTime, endTime) => {
  const sb = g_config.mediaSource.sourceBuffers[0];
  const start = startTime - 10 > 0 ? startTime - 10 : 0;
  const end = endTime || g_config.duration;
  sb.remove(start, Infinity);
};

g_config.createPlayer = async ({
  byteLength,
  readRequest,
  onFragment,
  onFFmpegMsgCallback,
}) => {
  if (!g_config.videoElement) {
    const [v, mediaSource] = await createMse();
    g_config.videoElement = v;
    g_config.mediaSource = mediaSource;
  }
  const controller = new SimpleMaxBufferTimeController(
    g_config.videoElement,
    g_config.mediaSource,
    g_config.clearMseBuffer
  );
  const player = new WasmMsePlayer(
    byteLength,
    readRequest,
    onFragment || g_config.onFragment,
    onFFmpegMsgCallback || g_config.onFFmpegMsgCallback,
    controller.pauseDecodeIfNeeded.bind(controller)
  );
  controller.setWakeupCallback(
    player._worker.wakeupWrapper.bind(player._worker)
  );
  controller.setFFmpegSeek(player._worker.seek.bind(player._worker));
  g_config.player = player;
};

g_config.run_player = RunPlayer;
globalThis.g_config = g_config;

export { g_config };
