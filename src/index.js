"use strict";

import * as Comlink from "comlink";
// import WasmWorker from "./wasm-worker.js";

export default class WasmMsePlayer {
  constructor(file_size, read_cb, onFragmentCb, onFFmpegMsgCb) {
    this._file_size = file_size;

    // stop using Webpack worker-loader, cause it has source map bug.
    // https://github.com/webpack-contrib/worker-loader/issues/245#issuecomment-823566476
    let worker = new Worker(new URL("./wasm-worker.js", import.meta.url));
    this._worker = Comlink.wrap(worker);

    this._read_cb = read_cb;
    this._on_fragment = onFragmentCb;
    this._on_ffmpeg_msg = onFFmpegMsgCb;
  }

  async _send_read_request(pos, max_read_n) {
    let ab;
    try {
      ab = await this._read_cb(pos, max_read_n);
    } catch (err) {
      console.error("WasmMsePlayer _read_cb met error:", err);
      return;
    }

    if (ab.byteLength > 0) {
      let view = new Uint8Array(ab);
      this._worker.transferAbToWorker(Comlink.transfer(view, [ab]));
    }
  }

  run() {
    this._worker.init(
      this._file_size,
      Comlink.proxy(this._on_fragment.bind(this)),
      Comlink.proxy(this._on_ffmpeg_msg.bind(this)),
      Comlink.proxy(this._send_read_request.bind(this))
    );
    this._worker.run();
  }
}
