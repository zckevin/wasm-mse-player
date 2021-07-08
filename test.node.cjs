"use strict";

const WasmMsePlayer = require("./dist/bundle.node.js").WasmMsePlayer;
const WasmFactory = require("./wasm/ffmpeg.node.cjs");
const fs = require("fs");

const videoAb = fs.readFileSync(
  "/home/zc/Downloads/video_samples/sample_1280x720_surfing_with_audio.mkv"
).buffer;

const onReadCb = async (pos, max_read_n) => {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  await sleep(1);
  console.log(`read req: ${pos} - ${pos + max_read_n}`);
  return videoAb.slice(pos, pos + max_read_n);
};

const fragments = [];
const onFragmentCb = (fragment) => {
  console.log(fragment)
  fragments.push(fragment);
};

const onFFmpegMsgCallback = (msg) => {
  console.log("onFFmpegMsg", msg);
  if (msg.cmd == "meta_info") {
    // assert(msg.duration && msg.duration > 0, "msg.duration is invalid");
    // assert(msg.codec && msg.codec.length > 0, "msg.codec is invalid");
    console.log(JSON.stringify(msg));
    // g_config.duration = msg.duration;
    // g_config.codec = `video/mp4; codecs="${msg.codec}, mp4a.40.2"`;
    // g_config.run_player();
  }
};

const player = new WasmMsePlayer(
  videoAb.byteLength,
  onReadCb,
  onFragmentCb,
  onFFmpegMsgCallback
);
// TODO: maybe fix this?
player._worker.wasm_factory = WasmFactory;
player.run();
