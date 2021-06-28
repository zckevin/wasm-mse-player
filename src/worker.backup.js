"use strict"

import factory from '../FFmpeg/wasm/dist/ffmpeg-core.js';
// import { assert, assertNotReached } from '../src/utils.js';

class InputFileDevice {
  constructor() {
    this._pos = 0;
  }

  open(stream, path, flags) {
    console.log("open", stream, path, flags);
    // return new Int8Array(1024 * 1024);
    return stream;
  }

  /**
   * Implements the read() operation for the emulated device.
   * @param {!FileStream} stream
   * @param {!Int8Array} buffer The destination buffer.
   * @param {number} offset The destination buffer offset.
   * @param {number} length The maximum length to read.
   * @param {number} position The position to read from stream.
   * @return {number} The numbers of bytes read.
   */
  read(stream, buffer, offset, length, position) {
		console.log("read_n:", offset, length, position)

    return read_n;
  }

  write(stream, buffer, offset, length, position) {
    console.log("write: ", length, JSON.stringify(Array.from(buffer.subarray(offset, offset + Math.min(length, 10)))));
    return length;
  }

  /**
   * Implements the llseek() operation for the emulated device.
   * Only SEEK_SET (0) is supported as |whence|. Reference:
   * https://emscripten.org/docs/api_reference/Filesystem-API.html#FS.llseek
   * @param {!FileStream} stream
   * @param {number} offset The offset in bytes relative to |whence|.
   * @param {number} whence The reference position to be used.
   * @return {number} The resulting file position.
   */
  llseek(stream, offset, whence) {
    // assert(whence === 0, 'only SEEK_SET is supported');
    this._pos = offset;
		console.log("seek:", offset, whence);
    return offset;
  }

  getFileOps() {
    return {
      open: this.open.bind(this),
      close: () => {console.log("close", arguments)},
      read: this.read.bind(this),
      write: this.write.bind(this),
      llseek: this.llseek.bind(this),
    };
  }
}

function jsstring_to_cstr(module, str) {
  // lengthBytesUTF8 and stringToUTF8Array are defined in the emscripten
  // JS.  See https://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html#stringToUTF8
  let strLen = module.lengthBytesUTF8(str);
  // Add 1 for null terminator, which we need when copying/converting
  let strPtr = module._malloc(strLen + 1);
  module.stringToUTF8(str, strPtr, strLen + 1);
  return strPtr;
}

function run_wasm(inputFile, callback) {
  const emscriten_config = {
    preRun: [() => {
      const fs = emscriten_config.FS;
      const mkv_device = fs.makedev(80, 1);
      fs.registerDevice(mkv_device, inputFile.getFileOps());
      fs.mkdev('/output.mp4', mkv_device);

      function noop_stdin() {}
      fs.init(noop_stdin, null, null);
    }],
  };
  
  return factory(emscriten_config).then(Module => {
    // let ptrs = cmd.split(" ").map(segment => jsstring_to_cstr(module, segment));
    // module.ccall("main", "number", ["number" /* argc */, "number" /* argv */], [ptrs.length, ptrs]);
    // ptrs.map(ptr => module._free(ptr));

    // const cmd = "ffmpeg -y -i assets/output.mp4 -c:v copy -c:a aac -movflags frag_keyframe+empty_moov+default_base_moof mse.mp4"

    // const cmd = "ffmpeg -y -i assets/output.mp4 -c copy output.mp4"
    // const cmd = "ffmpeg -y -i assets/Amaze-Dolby-thedigitaltheater.mp4 -c:v copy -c:a aac -movflags frag_keyframe+empty_moov+default_base_moof output.mp4"
    const cmd = "ffmpeg -y -i assets/Amaze-Dolby-thedigitaltheater.mp4 -c:v copy -c:a aac -movflags +faststart -f mov output.mp4"
    
    const args = cmd.split(" ");
    const ffmpeg = Module.cwrap('emscripten_proxy_main', 'number', ['number', 'number']);
    const argsPtr = Module._malloc(args.length * Uint32Array.BYTES_PER_ELEMENT);
    args.forEach((s, idx) => {
      const buf = Module._malloc(s.length + 1);
      Module.writeAsciiToMemory(s, buf);
      Module.setValue(argsPtr + (Uint32Array.BYTES_PER_ELEMENT * idx), buf, 'i32');
    })
    ffmpeg(args.length, argsPtr);
  });
}

let inputFile = new InputFileDevice();
run_wasm(inputFile);
