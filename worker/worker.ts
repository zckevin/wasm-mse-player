import { InputFileDevice, OutputFileDevice } from "./vfs";
import { SimpleMp4Parser } from "./mp4-parser";
import { Bridge } from "./bridge";
import EmscriptenEntry from "../wasm/ffmpeg.js";
import { IO } from "./io";

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

  public Run(file_size: number) {
    // @ts-ignore
    this.io = Comlink.wrap(self);
    this.atomParser = new SimpleMp4Parser(this.io);
    this.inputFile = new InputFileDevice(this.io, file_size);
    this.outputFile = new OutputFileDevice(this.io, file_size, this.atomParser);
    this.bridge = new Bridge(this.io, this.Module, this.inputFile, this.outputFile);

    this.emscripten_entry(this.Module).then(() => {
      this.Module.onAbort = () => {
        console.log("Aborted!");
      };
      this.startFFmpeg(this.Module);
    })
  }
}

const worker = new WasmWorker(EmscriptenEntry);
// Comlink 2-way communication: worker -> main
Comlink.expose(worker);

export default worker;
