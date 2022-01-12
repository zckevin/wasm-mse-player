import { Parser as BinaryParser } from "binary-parser";
import { assert } from "./assert.js";
import { IO } from "./io"

class Counter {
  private in: number = 0;
  private out: number = 0;

  addIn(n: number) {
    this.in += n;
  }

  addOut(n: number) {
    this.out += n;
  }
}

export interface Mp4Atom {
  length: number;
  atom_type: string;
  data: {
    buf: Uint8Array | null;
  };
}

export class SimpleMp4Parser {
  readonly buf_length = 16 * 1024 * 1024;
  private write_buf = new ArrayBuffer(this.buf_length);
  private buf_pos = 0;
  private file_pos = 0;
  private counter = new Counter();
  private atomParser: BinaryParser;
  private is_reset = false;

  constructor(
    private io: IO,
    private is_debugging: boolean = true,
  ) {
    this.initAtomParser();
    if (this.is_debugging) {
      setInterval(() => {
        console.log("WARN: left buffer size in mp4parser:", this.buf_pos);
      }, 5000);
    }
  }

  private initAtomParser() {
    const buf_parser = BinaryParser.start().buffer("buf", {
      length: function() {
        // length: u32, atom_type: u32
        return this.$parent.length - 4 - 4;
      }
    });

    // if data corruption happens, result.data.buf will be nil
    // check in this.is_parsing_error_met()
    const error_parser = BinaryParser.start();

    this.atomParser = BinaryParser.start()
      .useContextVars() // for $parent context variable
      .endianess("big")
      .uint32("length")
      .string("atom_type", {
        length: 4,
      })
      .choice("data", {
        tag: function () {
          return ["ftyp", "moov", "moof", "mdat", "mfra"].indexOf(this.atom_type) >=
            0
            ? 1
            : 0;
        },
        choices: {
          1: buf_parser,
          0: error_parser,
        },
      });
  }

  private tryParseAtom() {
    let atom: Mp4Atom;
    try {
      const view = new Uint8Array(this.write_buf, 0, this.buf_pos);
      atom = this.atomParser.parse(view);
    } catch(err) {
      if (err instanceof RangeError) {
        // not enough data
        return null;
      }
      throw err;
    }

    if (!(atom.atom_type && atom.data && atom.data.buf)) {
      console.error(atom);
      throw new Error("Invalid parsing atom");
    }
    // not enough data
    //
    // BinaryParser dose not check buffer length,
    // which just using buffer.slice(start, start + length),
    // so it may early return when data is not fullfilled yet.
    if (atom.data.buf.byteLength + 4 + 4 !== atom.length) {
      return null;
    }

    console.log("new atom", atom)

    // make a copy of Uint8Array, in case being overwitten in this.write_buf
    atom.data.buf = atom.data.buf.slice();

    // move left data to head of write_buf
    {
      // .slice() make a copy, so we could do .fill(0) safely
      const left_ab = this.write_buf.slice(atom.length, this.buf_pos);
      this.buf_pos = left_ab.byteLength;
      this.file_pos += atom.length;

      const view = new Uint8Array(this.write_buf);
      if (this.is_debugging) {
        view.fill(0);
      }
      view.set(new Uint8Array(left_ab));
    }

    this.counter.addOut(atom.length);

    return atom;
  }

  AppendBuffer(filePosition: number, buf: Int8Array): void {
    assert(
      this.buf_pos + buf.byteLength <= this.write_buf.byteLength,
      "AppendBuffer(): buffer overflow");

    if (this.is_reset) {
      this.is_reset = false;
      this.file_pos = filePosition;
    }
    this.counter.addIn(buf.byteLength);
    const view = new Int8Array(this.write_buf);
    view.set(buf, this.buf_pos);
    this.buf_pos += buf.byteLength;

    while (true) {
      const atom = this.tryParseAtom();
      if (atom === null) {
        break;
      }
      this.io.onNewAtom(atom);
    }
  }

  Reset() {
    this.buf_pos = 0;
    this.is_reset = true;
  }
}