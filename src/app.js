import * as Comlink from "comlink";
import { assert, assertNotReached } from "./assert.js";

// import WasmWorker from "./wasm-worker.js";
import WasmMsePlayer from "./index.js";

/******************************************************/

let fragments = [];
let g_duration = 0;
let g_codec = "";

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

    sb.appendBuffer(tmp);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(videoAb) {
  let readRequest = async (pos, max_read_n) => {
    // add some async to avoid dead lock in atomics.js
    await sleep(1);
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
}

/******************************************************/

const fileSelector = document.getElementById("file-selector");
fileSelector.addEventListener("change", (event) => {
  const file = event.target.files.item(0);
  let reader = new FileReader();

  reader.onload = function () {
    run(reader.result);
  };
  reader.readAsArrayBuffer(file);
});
