"use strict";

import * as Comlink from "comlink";
import WasmWorker from "./wasm-worker.js";
import WasmFactory from "../wasm/ffmpeg.web.js";

const _worker = new WasmWorker(WasmFactory);
Comlink.expose(_worker);

if (!globalThis.__second_part) {
  globalThis.__second_part = _worker.do_transcode_second_part.bind(_worker);
  globalThis.__seek = _worker.seek.bind(_worker);
}

export default _worker;
