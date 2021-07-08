"use strict";

import * as Comlink from "comlink";
import WasmWorker from "./wasm-worker.js";
import WasmFactory from "../wasm/ffmpeg.web.js";

const _worker = new WasmWorker(WasmFactory);
Comlink.expose(_worker);

export default _worker;
