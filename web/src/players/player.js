"use strict";

import { assert } from "../assert.js";
import { SimpleMaxBufferTimeController } from "../../../src/controller.js";
// import WasmMsePlayer from "../wasm-mse-player/bundle.js"
import WasmMsePlayer from "../../../index.js";
import { assertNotReached } from "../../../src/assert.js";

let g_config = {
  fragments: [],
  duration: 0,
  codec: "",
  player: null,
  videoElement: null,
  mediaSource: null,

  bufferedRangesCanvas: null,
  updateBufferedRangesCanvas: null,

  moof_mdat_info_pairs: [],
  bufferedRanges: [],
  is_first_moof_mdat_pair_start_from_zero: true,
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

function ignoreSeekingMoofStartFromZero(pairInfo) {
  if (pairInfo.from_seconds === 0) {
    // initial fragments without seeking
    if (g_config.is_first_moof_mdat_pair_start_from_zero) {
      g_config.is_first_moof_mdat_pair_start_from_zero = false;
      return false;
    }
    return true;
  }
  return false;
}

function appendBuffer(sb, start, end) {
  let n = 0;
  let fragPair = g_config.fragments.splice(start, end);
  const views = fragPair.map((parsedResult) => {
    let view = serialize_parsing_result_to_view(parsedResult);
    n += view.byteLength;
    return view;
  });

  // fill g_config.bufferedRanges
  {
    if (fragPair.length === 4) {
      // has ftyp+moov
      fragPair = fragPair.slice(2);
    }
    assert(fragPair.length === 2, "invalid moof+mdat pair");
    assert(
      g_config.moof_mdat_info_pairs.length > 0,
      "g_config.moof_mdat_info_pairs should not be empty"
    );

    const moof = fragPair[0];
    const mdat = fragPair[1];
    for (const pairInfo of g_config.moof_mdat_info_pairs) {
      if (
        pairInfo.moof_size === moof.length &&
        pairInfo.mdat_size === mdat.length
      ) {
        g_config.bufferedRanges.push({
          start: pairInfo.from_seconds,
          end: pairInfo.to_seconds,
        });

        if (ignoreSeekingMoofStartFromZero(pairInfo)) {
          console.log(
            "ignore invalid moof+mdat pair because of seeking",
            pairInfo
          );
          return;
        }
        break;
      }
    }
  }

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

g_config.setupBufferedRangesCanvas = () => {
  const videoEl = g_config.videoElement;
  const myCanvas = g_config.bufferedRangesCanvas;
  const context = myCanvas.getContext("2d");

  videoEl.addEventListener("progress", function () {
    // wait for g_config.duration is fullfilled
    const inc = myCanvas.width / g_config.duration;

    for (let i = 0; i < videoEl.buffered.length; i++) {
      var startX = videoEl.buffered.start(i) * inc;
      var endX = videoEl.buffered.end(i) * inc;

      context.fillRect(startX, 0, endX, 20);
      context.rect(startX, 0, endX, 20);
      context.stroke();
    }
  });
};

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
      // initial fragments for MSE have to be ftyp+moov+moof+mdat,
      // dont ask why...
      if (matcher("ftyp", "moov", "moof", "mdat")) {
        appendBuffer(sb, 0, 4);
        console.log("@@append init");
        moovEmitted = true;
        return;
      }
    }
    if (moovEmitted && fragments.length >= 2) {
      if (matcher("moof", "mdat")) {
        appendBuffer(sb, 0, 2);
        console.log("@@append a fragment");
        return;
      } else {
        while (!matcher("moof", "mdat")) {
          const removed = fragments.shift();
          console.log("emitted but removed fragment", removed);
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
  if (msg.cmd === "meta_info") {
    assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
    assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
    // alert(JSON.stringify(msg));
    console.log(JSON.stringify(msg));

    g_config.duration = msg.duration;
    g_config.codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;

    g_config.run_player();
  } else if (msg.cmd === "moof_mdat") {
    /**
     * {
     *   cmd: "moof_mdat",
     *   from_seconds: 0,
     *   to_seconds: 6.0424,
     *   mdat_size: 56341,
     *   moof_size: 5192,
     * }
     */
    g_config.moof_mdat_info_pairs.push(msg);
  } else {
    assertNotReached(`unknown msg: ${JSON.stringify(msg)}`);
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
    g_config.bufferedRangesCanvas = document.getElementById("buffered-ranges");
    g_config.setupBufferedRangesCanvas();
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
