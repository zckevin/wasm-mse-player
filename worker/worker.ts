import { InputFileDevice, OutputFileDevice } from "./vfs";
import { SimpleMp4Parser } from "./mp4-parser";
import { Bridge } from "./bridge";
import EmscriptenEntry from "../wasm/ffmpeg.js";
import { IO } from "./io";
import { assert } from "./assert";

import * as Comlink from "comlink";

export class WasmWorker {
  private inputFile: InputFileDevice;
  private outputFile: OutputFileDevice;
  private atomParser: SimpleMp4Parser;
  private io: IO;
  private bridge: Bridge;

  private Module: any = {
    preRun: [
      () => {
        const fs = this.Module.FS;

        const input_device = fs.makedev(80, 1);
        fs.registerDevice(input_device, this.inputFile.getFileOps());
        // constainer format could be mp4 or mkv or webm
        fs.mkdev("/input.file", input_device);

        const output_device = fs.makedev(80, 3);
        fs.registerDevice(output_device, this.outputFile.getFileOps());
        fs.mkdev("/output.mp4", output_device);

        // ignore ffmpeg stdin prompt
        function noop_stdin() {}
        fs.init(noop_stdin, null, null);
      },
    ],
  };

  constructor(
    private emscripten_entry: (config: any) => Promise<any>,
  ) {}

  private startFFmpeg(Module: any) {
    const cmd = [
      "ffmpeg",
      // confirm on file overwitten
      "-y",
      // disable interaction on standard input
      "-nostdin",
      "-loglevel info",
      // Infinity times input stream shall be looped
      // "-stream_loop -1",
      "-i input.file",
      // video codec copy, audio codec to AAC LC
      "-c:v copy -c:a aac",
      // configure AAC channel info, without it MSE may throw errro
      "-channel_layout stereo",
      // generate Fmp4
      "-movflags frag_keyframe+empty_moov+default_base_moof",
      // max moov+moof size: 1MB
      "-frag_size 1000000",
      // min moov+moof duration: 0.5 seconds
      "-min_frag_duration 500000",
      // max fragment duration 1000ms
      // "-frag_duration 1000",
      // output container format MP4/MOV
      "-f mov",
      "output.mp4",
    ].join(" ");
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
      ffmpeg(args.length, argsPtr);
    } catch (err) {
      console.error("ffmpeg wasm exits with error:", err);
    }
  }

  private wakeupCb: (shouldExit: number) => void | null;
  private delayedSeek: {
    targetTime: number,
  } | null = null;

  /**
   * This callback fired after FFmpeg instance is sleeping
   * @param wakeup 
   * @param pkt_pts 
   * @param is_eof 
   * @returns 
   */
  public onFFmpegPaused(wakeupCb: (shouldExit: number) => void, pkt_pts: number, is_eof: number) {
    this.wakeupCb = wakeupCb;

    // if has delayed seek task, wakeup & abort FFmpeg instance right now
    if (this.delayedSeek) {
      this.wakeup(1);
    } else {
      this.io.onFFmpegPaused(pkt_pts, is_eof);
    }
  }

  /**
   * Continue the FFmpeg instance
   * 
   * If shouldExit is 1, FFmpeg will **abort** right after we continue from 
   * the Asyncify callback
   * 
   * @param shouldExit 
   * @returns 
   */
  public wakeup(shouldExit: number) {
    if (!this.wakeupCb) {
      return;
    }
    console.log("wakeup ffmpeg, shouldExit:", shouldExit);
    const fn = this.wakeupCb;
    this.wakeupCb = null;

    fn(shouldExit);

    if (shouldExit === 1 && this.delayedSeek) {
      this.runDelayedSeek();
    }
  }

  /**
   * Kill the running FFmpeg wasm and spawn a new one with the seeking target time
   * 
   * Because seek must be done after the existing FFmpeg instance exits,
   * we setup a delayed task here and fires it at the next time FFmpeg goes 
   * into sleep(this.onFFmpegPaused()) or just got waked up(this.wakeup())
   * 
   * @param targetTime 
   */
  public seek(targetTime: number) {
    this.delayedSeek = {
      targetTime,
    };
    this.wakeup(1);
  }

  private runDelayedSeek() {
    assert(this.delayedSeek);

    // clear internal state in parsers
    this.atomParser.Reset();
    this.io.onSeek();

    // seek to target time
    let { targetTime } = this.delayedSeek;
    const shift_back_seconds = 5;
    targetTime = Math.max(0, targetTime - shift_back_seconds);
    setTimeout(() => this.transcode_second_part(targetTime), 100);

    this.delayedSeek = null;
    return true;
  }

  private memory_snapshot: Uint8Array;
  private snapshot_wasm_module: any;

  /**
   * FFmpeg has got metainfo data about the video file, it's time to 
   * take snapshot of the wasm memory.
   */
  public do_snapshot() {
    assert(!this.memory_snapshot);
    console.log("do_snapshot()")
    // make a copy here
    this.memory_snapshot = 
      (new Uint8Array(this.snapshot_wasm_module.asm.memory.buffer)).slice();
  }

  /**
   * Spawn a new worker with the saved memory snapshot, and seek to the target time.
   * @param targetTime 
   */
  private transcode_second_part(targetTime: number = 0) {
    this.emscripten_entry({})
    .then((NewModule) => {
      // set this module as default
      this.Module = NewModule;

      const from = this.memory_snapshot;
      const to = new Uint8Array(NewModule.asm.memory.buffer);
      assert(from.buffer !== to.buffer);

      // copy memory
      for (let i = 0; i < from.byteLength; i++) {
        to[i] = from[i];
      }

      // copy fs ops
      for (const key in NewModule.FS) {
        NewModule.FS[key] = this.snapshot_wasm_module.FS[key];
      }

      // do seeking if needed
      if (targetTime != 0) {
        NewModule._wasm_set_seek_target(targetTime);
      }

      // do transcoding
      NewModule._wasm_transcode_second_part();
    })
    .catch((err) => {
      console.log("FFmpeg instance exit with error:", err);
    })
  }

  public Run(file_size: number) {
    // @ts-ignore
    this.io = Comlink.wrap(self);
    this.atomParser = new SimpleMp4Parser(this.io);
    this.inputFile = new InputFileDevice(this.io, file_size);
    this.outputFile = new OutputFileDevice(this.io, file_size, this.atomParser);
    this.bridge = new Bridge(this, this.io, this.Module, this.inputFile, this.outputFile);

    this.emscripten_entry(this.Module)
    .then(() => {
      this.snapshot_wasm_module = this.Module;
      this.startFFmpeg(this.Module);
    })
    .catch((err) => {
      console.log("FFmpeg instance exit with error:", err);
    })
  }
}

const worker = new WasmWorker(EmscriptenEntry);
// Comlink 2-way communication: worker -> main
Comlink.expose(worker);

export default worker;
