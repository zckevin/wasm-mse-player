import { assert, assertNotReached } from "./assert.js";
import SimpleMp4Parser from "./mp4-parser.js";

class InputFileDevice {
  constructor(file_size, atomic_reader) {
    this._atomic_reader = atomic_reader;
    this._buf_pos = 0;
    this._file_size = file_size;
  }

  open(stream, path, flags) {
    if (!stream.node.node_ops.getattr._swapped) {
      let original = stream.node.node_ops.getattr;
      let proxy_func = function (...args) {
        let attr = original(...args);
        attr.size = this._file_size;
        console.log(`getattr return file_size: ${this._file_size}`);
        return attr;
      };
      stream.node.node_ops.getattr = proxy_func.bind(this);
      stream.node.node_ops.getattr._swapped = true;
    }
    console.log("open", stream, path, flags);
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
    let ab = this._atomic_reader.BlockRead(this._pos, length);
    let read_n = ab.byteLength;
    // console.log(`read_n: read_n(${read_n})`, ab);

    buffer.set(new Int8Array(ab), offset);

    // move file cursor forward
    this._pos += read_n;
    return read_n;
  }

  write(stream, buffer, offset, length, position) {
    assertNotReached("InputFileDevice should not call write()");
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
    assert(whence === 0, "only SEEK_SET is supported");
    this._pos = offset;
    console.log("seek:", offset, whence);
    return offset;
  }

  getFileOps() {
    return {
      open: this.open.bind(this),
      close: () => {
        console.log("close", arguments);
      },
      read: this.read.bind(this),
      write: this.write.bind(this),
      llseek: this.llseek.bind(this),
    };
  }
}

class OutputFileDevice {
  constructor(onFragmentCallback) {
    this._parser = new SimpleMp4Parser();
    this._parser.RunParseLoop(onFragmentCallback)
  }

  open(stream, path, flags) {
    console.log("open", stream, path, flags);
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
    assertNotReached("OutputFileDevice should not call read()");
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
    let view = buffer.subarray(offset, offset + length);
    this._parser.AppendUint8View(view);
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
    assert(whence === 0, "only SEEK_SET is supported");
    this._pos = offset;
    console.log("seek:", offset, whence);
    return offset;
  }

  getFileOps() {
    return {
      open: this.open.bind(this),
      close: () => {
        console.log("close", arguments);
      },
      read: this.read.bind(this),
      write: this.write.bind(this),
      llseek: this.llseek.bind(this),
    };
  }
}

export { InputFileDevice, OutputFileDevice };
