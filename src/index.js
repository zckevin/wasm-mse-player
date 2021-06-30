"use strict"

import * as Comlink from "comlink";
import WasmWorker from "./wasm-worker.js";

import { assert, assertNotReached } from "./assert.js"
import { AtomicWriter, SHARED_ARRAY_BUFFER_INDEX } from "./atomics.js"

export default class WasmMsePlayer {
  constructor(file_size, read_cb, onFragmentCb, onFFmpegMsgCb) {
    this._file_size = file_size;

    this._atomic_writer = new AtomicWriter();
    this._worker = Comlink.wrap(new WasmWorker());

    this._read_cb = read_cb;
    this._on_fragment = onFragmentCb;
    this._on_ffmpeg_msg = onFFmpegMsgCb;
  }

  async _send_read_request(pos, max_read_n) {
    let ab;
    try {
      ab = await this._read_cb(
        pos,
        Math.min(this._atomic_writer.BufferSize, max_read_n)
      );
    } catch(err) {
      console.error("WasmMsePlayer _read_cb met error:", err);
      return;
    }

    if (ab.byteLength > 0) {
      this._atomic_writer.Write(ab);
    }
  }

  run() {
    this._worker.init(
      this._file_size,
      this._atomic_writer,
      Comlink.proxy(this._on_fragment.bind(this)),
      Comlink.proxy(this._on_ffmpeg_msg.bind(this)),
      Comlink.proxy(this._send_read_request.bind(this)),
    );
    this._worker.run();
  }
}
