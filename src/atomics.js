import { assert, assertNotReached } from "./assert.js";

const SHARED_ARRAY_BUFFER_INDEX = {
  SEMAPHORE: 0,
  READ_N: 1,
};

class AtomicWriter {
  constructor() {
    this._sync_sab = new SharedArrayBuffer(
      4 * Object.keys(SHARED_ARRAY_BUFFER_INDEX).length
    );
    this._sync_int32_array = new Int32Array(this._sync_sab);
    this._data_sab = new SharedArrayBuffer(5 * 1024 * 1024); // 5 MB buffer
  }

  get BufferSize() {
    return this._data_sab.byteLength;
  }

  Write(ab) {
    assert(this._data_sab.byteLength >= ab.byteLength);
    assert(
      Atomics.load(
        this._sync_int32_array,
        SHARED_ARRAY_BUFFER_INDEX.SEMAPHORE
      ) === 0,
      "AtomicWriter's write should be called after AtomicReader's read"
    );

    let sab_view = new Int8Array(this._data_sab);
    let ab_view = new Int8Array(ab);
    sab_view.set(ab_view, 0);

    Atomics.store(
      this._sync_int32_array,
      SHARED_ARRAY_BUFFER_INDEX.READ_N,
      ab.byteLength
    );
    Atomics.store(
      this._sync_int32_array,
      SHARED_ARRAY_BUFFER_INDEX.SEMAPHORE,
      1
    );
    Atomics.notify(this._sync_int32_array, SHARED_ARRAY_BUFFER_INDEX.SEMAPHORE);
  }
}

class AtomicReader {
  constructor(atomic_writer, requestReadCallback) {
    this._data_sab = atomic_writer._data_sab;
    this._sync_int32_array = new Int32Array(atomic_writer._sync_sab);

    this.requestReadCallback = requestReadCallback;
  }

  _block_wait(timeout = Infinity) {
    let result = Atomics.wait(
      this._sync_int32_array,
      SHARED_ARRAY_BUFFER_INDEX.SEMAPHORE,
      0, // main thread set this to 1 on new data
      timeout
    );
    if (result === "timed-out") {
      return true;
    }
    return false;
  }

  BlockRead(pos, max_read_n) {
    // NON-BLOCKING
    this.requestReadCallback(pos, max_read_n);

    // BLOCKING!
    let is_timeout = this._block_wait();
    if (is_timeout) {
      console.error("InputFileDevice request_read timeout");
      return new ArrayBuffer();
    }

    let read_n = Atomics.load(
      this._sync_int32_array,
      SHARED_ARRAY_BUFFER_INDEX.READ_N
    );
    let ab = this._data_sab.slice(0, read_n);

    Atomics.store(
      this._sync_int32_array,
      SHARED_ARRAY_BUFFER_INDEX.SEMAPHORE,
      0
    );
    Atomics.notify(this._sync_int32_array, SHARED_ARRAY_BUFFER_INDEX.SEMAPHORE);

    return ab;
  }
}

export { AtomicReader, AtomicWriter, SHARED_ARRAY_BUFFER_INDEX };
