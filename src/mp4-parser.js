import { Parser as BinaryParser } from 'binary-parser'; 
import { assert, assertNotReached } from './assert.js';

let buf_parser =
  BinaryParser.start()
		.buffer('buf', {
		  length: '$parent.length - 4 - 4',
		});

// if data corruption happens, result.data.buf will be nill
// check in this.is_parsing_error_met()
let error_parser = BinaryParser.start();

let mp4parser =
  BinaryParser.start()
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

export default class SimpleMp4Parser {
  constructor() {
    this._write_buf = new ArrayBuffer(64 * 1024 * 1024);
    this._buf_pos = 0;
    this._clear_buf_for_debugging = true;
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

  try_parse(view) {
    if (this._buf_pos + view.byteLength > this._write_buf.byteLength) {
      assert(this._buf_pos + view.byteLength <= this._write_buf.byteLength);
    }

    // copy write data to _write_buf
    {
      let buf_view = new Uint8Array(this._write_buf);
      buf_view.set(view, this._buf_pos);
      this._buf_pos += view.byteLength;
    }

    // call BinaryParser
    let result;
    try {
      let view = new Uint8Array(this._write_buf, 0, this._buf_pos);
      result = mp4parser.parse(view);
    } catch(err) {
      if (err instanceof RangeError) {
        // error means need more data
        return null; 
      }
      throw err;
    }

    // if parsing error/corruption met, fatal
    if (this.is_parsing_error_met(result)) {
      throw "Parsing error";
    }
    // if non-meanningful parsing result met, wait for more data
    if (!this.is_meaningful_parsing_result(result)) {
      return null;
    }

    // copy buf in result in case being overwitten in this._write_buf
    result.data.buf = result.data.buf.slice();

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
}
