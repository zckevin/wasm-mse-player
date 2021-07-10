"use strict";

import * as Comlink from "comlink";

/*
 * @file_size: Number
 * @onReadCb: Function (pos: Number, max_read_n: Number): return ArrayBuffer
 * @onFragmentCb: Function (fragment: Mp4ParsingResult)
 * @onFFmpegMsgCb: Function (msg: PlainOldObject)
 */
export default class WasmMsePlayer {
  constructor(
    file_size,
    onReadCb,
    onFragmentCb,
    onFFmpegMsgCb,
    pauseDecodeIfNeeded
  ) {
    // stop using Webpack worker-loader, which has a chrome related source map bug.
    // https://github.com/webpack-contrib/worker-loader/issues/245#issuecomment-823566476
    const worker = new Worker(
      new URL("./src/wasm-worker.web.js", import.meta.url)
    );

    this._raw_worker = worker;
    this._worker = Comlink.wrap(worker);

    this._read_cb = onReadCb;

    this._worker.init(
      file_size,
      Comlink.proxy(onFragmentCb),
      Comlink.proxy(onFFmpegMsgCb),
      Comlink.proxy(this._send_read_request.bind(this)),
      Comlink.proxy(pauseDecodeIfNeeded)
    );
    this._worker.run();
  }

  // wrapper function to send ArrayBuffer to worker
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

  stop() {
    this._worker.stop();
    this._raw_worker.terminate();
  }
}
