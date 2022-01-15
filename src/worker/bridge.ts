import { IO, FFmpegMsgName } from "../main/io";
import { InputFileDevice, OutputFileDevice } from "./vfs";
import { WasmWorker } from "./worker";

type Pointer = number;

export class Bridge {
  constructor(
    private worker: WasmWorker,
    private io: IO,
    private inputFile: InputFileDevice,
    private outputFile: OutputFileDevice,
  ) {
    // @ts-ignore
    globalThis.bridge = this;
  }

  public wait_read_result(wakeup: (read_n: number) => void, ...args: any[]) {
    // @ts-ignore
    this.inputFile.wait_read_result(...args).then((read_n) => {
      wakeup(read_n);
    })
  }

  public msg_callback(namePtr: Pointer, jsonStringPtr: Pointer) {
    const name = this.worker.getModule().UTF8ToString(namePtr) as FFmpegMsgName;
    const jsonString = this.worker.getModule().UTF8ToString(jsonStringPtr) as string;

    // string from aborted FFmpeg instance
    if (jsonString.length <= 0) {
      return;
    }
    try {
      const msg = JSON.parse(jsonString);
      this.io.onMessage(name, msg);
    } catch(err) {
      console.error("msg_callback(), JSON parse error:", name, jsonString)
      throw err;
    }
  }

  public pause_decode(wakeup: (shouldExit: number) => void, wasm_instance_id:number, pkt_pts: number, is_eof: number) {
    console.log("pause_decode", wasm_instance_id, pkt_pts, is_eof);
    this.worker.onFFmpegPaused(wakeup, wasm_instance_id, pkt_pts, is_eof);
  }

  public do_snapshot() {
    this.worker.do_snapshot();
  }
}
