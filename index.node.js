"use strict";

import WasmWorker from "./src/wasm-worker.js";

/*
 * @file_size: Number
 * @onReadCb: Function (pos: Number, max_read_n: Number): return ArrayBuffer
 * @onFragmentCb: Function (fragment: Mp4ParsingResult)
 * @onFFmpegMsgCb: Function (msg: PlainOldObject)
 */
export class WasmMsePlayer {
  constructor(file_size, onReadCb, onFragmentCb, onFFmpegMsgCb) {
    this._file_size = file_size;

    this._worker = new WasmWorker();

    this._read_cb = onReadCb;
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
      this._worker.transferAbToWorker(view);
    }
  }

  stop() {
    // this._worker.stop();
    // this._raw_worker.terminate();
  }

  run() {
    this._worker.init(
      this._file_size,
      this._on_fragment.bind(this),
      this._on_ffmpeg_msg.bind(this),
      this._send_read_request.bind(this)
    );
    this._worker.run();
  }
}
