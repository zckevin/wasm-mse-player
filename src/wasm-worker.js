"use strict";

import * as Comlink from "comlink";

import factory from "../dist/ffmpeg.js";
import { assert, assertNotReached } from "./assert.js";
import { OutputFileDevice, InputFileDevice } from "./vfs.js";

class WasmWorker {
  constructor() {
    let emscriten_config = {
      preRun: [
        () => {
          const fs = emscriten_config.FS;

          const input_device = fs.makedev(80, 1);
          fs.registerDevice(input_device, this.inputFile.getFileOps());
          // constainer format could be mp4 or mkv or webm
          fs.mkdev("/input.file", input_device);

          const output_device = fs.makedev(80, 3);
          fs.registerDevice(output_device, this.outputFile.getFileOps());
          fs.mkdev("/output.mp4", output_device);

          // ignore ffmpeg stdin prompt
          function noop_stdin() {
            return null;
          }
          fs.init(noop_stdin, null, null);
        },
      ],
    };
    this.emscriten_config = emscriten_config;
    this._module = null;
  }

  init(file_size, onFragmentCallback, onFFmpegMsgCallback, sendReadRequest) {
    this.onFFmpegMsgCallback = onFFmpegMsgCallback;

    this.inputFile = new InputFileDevice(file_size, sendReadRequest);
    this.outputFile = new OutputFileDevice(file_size, onFragmentCallback);

    globalThis.waitReadable = (callback) => {
      this.inputFile.setReadableCallback(callback);
    };
  }

  // this.onFFmpegMsgCallback is a JSProxy, wrap it up using a function
  _ffmpeg_callback_delegate(utf8text) {
    assert(
      this.onFFmpegMsgCallback,
      "onFFmpegMsgCallback should not be undefined"
    );
    let msg = JSON.parse(this._module.UTF8ToString(utf8text));
    this.onFFmpegMsgCallback(msg);
  }

  _runFFmpeg(Module) {
    // const cmd = `ffmpeg -v trace -i input.file`
    // TODO: make this multiline
    const cmd = `ffmpeg -y -loglevel info -i input.file -c:v copy -c:a aac -channel_layout stereo -movflags frag_keyframe+empty_moov+default_base_moof -frag_size 5000000 -f mov output.mp4`;

    // create char** argv
    const args = cmd.split(" ");
    const argsPtr = Module._malloc(args.length * Uint32Array.BYTES_PER_ELEMENT);
    args.forEach((s, idx) => {
      const buf = Module._malloc(s.length + 1);
      Module.writeAsciiToMemory(s, buf);
      Module.setValue(
        argsPtr + Uint32Array.BYTES_PER_ELEMENT * idx,
        buf,
        "i32"
      );
    });

    const ffmpeg = Module.cwrap(
      // 'emscripten_proxy_main'
      "main",
      "number",
      [
        "number", // int argc
        "number", // char** argv
      ],
      { async: true }
    );

    try {
      // vi => void(int)
      var cb = Module.addFunction(
        this._ffmpeg_callback_delegate.bind(this),
        "vi"
      );
      Module._add_js_callback(cb);

      ffmpeg(args.length, argsPtr);
    } catch (err) {
      console.error("ffmpeg wasm exits with:", err);
    }
  }

  // TODO: remove this later
  transferAbToWorker(view) {
    try {
      let ab = view.buffer;
      this.inputFile.append(ab);
    } catch (err) {
      console.log("transferAb err", err);
    }
  }

  stop() {
    this.inputFile._stopped = true;
  }

  run() {
    factory(this.emscriten_config).then((Module) => {
      this._module = Module;
      this._runFFmpeg(Module);
    });
  }
}

let _worker = new WasmWorker();
Comlink.expose(_worker);

export default _worker;
