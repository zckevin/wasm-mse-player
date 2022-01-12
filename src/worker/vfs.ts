import { assert, assertNotReached } from "../assert.js";
import { SimpleMp4Parser } from "./mp4-parser";
import { IO } from "../main/io"

class FileDevice {
  protected pos: number = 0;
  protected ended: boolean = false;

  constructor() {}

  open(stream: any, path: any, flags: any) {
    console.log("FS.open()", stream, path, flags);
    return stream;
  }

  read(stream: any, buffer: Int8Array, offset: number, length: number, position: number) {
    assertNotReached("FS.read() not implemented");
  }

  write(stream: any, buffer: Int8Array, offset: number, length: number, position: number) {
    assertNotReached("FS.write() not implemented");
  }

  llseek(stream: any, offset: number, whence: number) {
    assert(whence === 0, "only SEEK_SET is supported");
    this.pos = offset;
    console.log("FS.llseek()", offset, whence);
    return offset;
  }

  close() {
    console.log("FS.close()");
  }

  getFileOps() {
    return {
      open: this.open.bind(this),
      read: this.read.bind(this),
      write: this.write.bind(this),
      llseek: this.llseek.bind(this),
      close: this.close.bind(this),
    };
  }
}

export class InputFileDevice extends FileDevice {
  private lastReadClosure: {
    result: Promise<ArrayBuffer>,
    buffer: Int8Array,
    offset: number,
  };

  constructor(
    private io: IO,
    private file_size: number,
  ) {
    super();
  }

  open(stream: any, path: any, flags: any) {
    // FFmpeg need corrent file size to do seek,
    // so web manually overwrite file size in returned inode data.
    if (!stream.node.node_ops.getattr._swapped) {
      const original = stream.node.node_ops.getattr;
      const proxy_func = function (...args: any[]) {
        const attr = original(...args);
        attr.size = this.file_size;
        return attr;
      };
      stream.node.node_ops.getattr = proxy_func.bind(this);
      stream.node.node_ops.getattr._swapped = true;
    }
    console.log("open:", stream, path, flags);
    return stream;
  }

  read(stream: any, buffer: Int8Array, offset: number, length: number, position: number) {
    this.lastReadClosure = {
      result: this.io.read(this.pos, length || 512 * 1024),
      buffer,
      offset,
    };
    return 0;
  }

  async wait_read_result() {
    const result = await this.lastReadClosure.result;
    const read_n = result.byteLength;
    console.log(`FS.read():`, this.lastReadClosure, read_n);

    this.lastReadClosure.buffer.set(
      new Int8Array(result),
      this.lastReadClosure.offset
    );

    this.pos += read_n;
    return read_n;
  }
}

export class OutputFileDevice extends FileDevice {
  constructor(
    private io: IO,
    private file_size: number,
    private atomParser: SimpleMp4Parser
  ) {
    super();
  }

  write(stream: any, buffer: Int8Array, offset: number, length: number, position: number) {
    console.log("FS.write():", length, offset);
    this.atomParser.AppendBuffer(position, buffer.subarray(offset, offset + length));
    return length;
  }
}