"use strict"

import factory from '../dist/ffmpeg.js';
import { assert, assertNotReached } from './utils.js';
const BinaryParser = require("binary-parser").Parser;

const MAX_MP4_MDAT_FRAGMENT_SIZE = 5 * 1024 * 1024; // 5 MB

class InputFileDevice {
  constructor() {
    this._write_buf = new ArrayBuffer(16 * 1024 * 1024);
    this._buf_pos = 0;

    this._clear_buf_for_debugging = true;

		let buf_parser = BinaryParser.start()
		    .buffer('buf', {
		      length: '$parent.length - 4 - 4',
		    });
		let error_parser = BinaryParser.start();
    this._parser = BinaryParser.start()
			  .endianess('big')
			  .uint32('length')
			  .string('atom_type', {
			    length: 4,
			  })
			  .choice('data', {
			      tag : function() { 
			        return ['ftyp', 'moov', 'moof', 'mdat', 'mfra'].indexOf(this.atom_type) >= 0
			            ? 1
			            : 0;
			      },
			      choices: {
			        1: buf_parser,
			        0: error_parser,
			      },
			  });
  }

  is_parsing_error_met(result) {
    if (result.atom_type && result.data && result.data.buf) {
      return false;
    }
    return true;
  }

  is_meaningful_parsing_result(result) {
    // BinaryParser dose not check Buffer length
    if (result.data.buf.byteLength + 4 + 4 !== result.length) {
      return false;
    }
    return true;
  }

  try_parse(ab) {
    assert(this._buf_pos + ab.byteLength <= this._write_buf.byteLength);

    // copy write data to _write_buf
    {
      let buf_view = new Uint8Array(this._write_buf);
      buf_view.set(new Uint8Array(ab), this._buf_pos);
      this._buf_pos += ab.byteLength;
    }

    let result;
    try {
      let view = new Uint8Array(this._write_buf, 0, this._buf_pos);
      result = this._parser.parse(view);
    } catch(err) {
      if (err instanceof RangeError) {
        // error means need more data
        return null; 
      }
      throw err;
    }

    if (this.is_parsing_error_met(result)) {
      throw "Parsing error";
    }
    if (!this.is_meaningful_parsing_result(result)) {
      return null;
    }

    // copy left data to head of _write_buf
    // .slice() make a copy, then we could do .fill(0) safely
    let left_ab = this._write_buf.slice(result.length, this._buf_pos);
    this._buf_pos = left_ab.byteLength;
    {
      let view = new Uint8Array(this._write_buf);
      if (this._clear_buf_for_debugging) {
        view.fill(0);
      }
      view.set(new Uint8Array(left_ab));
    }

    return result;
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

  /**
   * Implements the write() operation for the emulated device.
   * @param {!FileStream} stream
   * @param {!Int8Array} buffer The source buffer.
   * @param {number} offset The source buffer offset.
   * @param {number} length The maximum length to be write.
   * @param {number=} position The position to write in stream.
   * @return {number} The numbers of bytes written.
   */
  write(stream, buffer, offset, length, position) {
    // console.log("write", offset, length)
    let ab = buffer.subarray(offset, offset + length);

    let frag;

    // for debugging
    // if (false) {
    if (true) {
      try {
        frag = this.try_parse(ab);
      } catch (err) {
        console.log(err)
      }
    } else {
      frag = this.try_parse(ab);
    }

    if (frag) {
      console.log(frag.atom_type, frag.length);
    }
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
    assert(whence === 0, 'only SEEK_SET is supported');
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

      // ignore ffmpeg std input prompt
      function noop_stdin() {return null;}
      fs.init(noop_stdin, null, null);
    }],
  };
  
  return factory(emscriten_config).then(async (Module) => {
    const cmd = `ffmpeg -y -loglevel info -i assets/Amaze-Dolby-thedigitaltheater.mp4 -c:v copy -c:a aac -movflags frag_keyframe+empty_moov+default_base_moof -f mov output.mp4`
    
    const args = cmd.split(" ");
    const argsPtr = Module._malloc(args.length * Uint32Array.BYTES_PER_ELEMENT);
    args.forEach((s, idx) => {
      const buf = Module._malloc(s.length + 1);
      Module.writeAsciiToMemory(s, buf);
      Module.setValue(argsPtr + (Uint32Array.BYTES_PER_ELEMENT * idx), buf, 'i32');
    })

    // const ffmpeg = Module.cwrap('emscripten_proxy_main', 'number', ['number', 'number']);
    const ffmpeg = Module.cwrap('main', 'number', ['number', 'number']);
    ffmpeg(args.length, argsPtr);
  });
}

let inputFile = new InputFileDevice();
run_wasm(inputFile);
