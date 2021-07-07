import { assert } from "../assert.js";

let g_config = {
  fragments: [],
  duration: 0,
  codec: "",
  player: null,
};

function createMse() {
  return new Promise((resolve) => {
    const v = document.getElementsByTagName("video")[0];
    assert(v, "video element not found?");

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
  const [v, mediaSource] = await createMse();
  mediaSource.duration = g_config.duration;
  console.log(g_config.codec);

  let sb = mediaSource.addSourceBuffer(g_config.codec);
  setInterval(() => {
    const fragments = g_config.fragments;
    if (fragments.length >= 4 && !sb.updating) {
      if (
        fragments[0].atom_type === "ftyp" &&
        fragments[1].atom_type === "moov" &&
        fragments[2].atom_type === "moof" &&
        fragments[3].atom_type === "mdat"
      ) {
        appendBuffer(sb, 0, 4);
        console.log("@@append init");
        return;
      }
    }
    if (fragments.length >= 2 && !sb.updating) {
      if (
        fragments[0].atom_type === "moof" &&
        fragments[1].atom_type === "mdat"
      ) {
        appendBuffer(sb, 0, 2);
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

g_config.onFragment = (fragment) => {
  g_config.fragments.push(fragment);
};

g_config.onFFmpegMsgCallback = (msg) => {
  console.log("onFFmpegMsg", msg);
  if (msg.cmd == "meta_info") {
    assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
    assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
    alert(JSON.stringify(msg));

    g_config.duration = msg.duration;
    g_config.codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;

    g_config.run_player();
  }
};

g_config.run_player = RunPlayer;

export { g_config };