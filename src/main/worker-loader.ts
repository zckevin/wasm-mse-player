import * as Comlink from "comlink";
import { WasmWorker } from "../worker/worker"
import { IO } from "./io";

export class WasmWorkerLoader {
  private worker: Worker;
  public wrapped_worker: Comlink.Remote<WasmWorker>;

  constructor(
    file_size: number,
    io: IO,
  ) {
    this.worker = new Worker(
      // @ts-ignore
      new URL("../worker/worker.ts", import.meta.url),
      { type: "module"}
    );
    // Comlink 2-way communication: main -> worker
    Comlink.expose(io, this.worker);

    this.wrapped_worker = Comlink.wrap(this.worker);
    this.wrapped_worker.Run(file_size);
  }
}
