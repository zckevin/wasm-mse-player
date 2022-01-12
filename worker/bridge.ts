import { IO, MessageName } from "./io";
import { InputFileDevice, OutputFileDevice } from "./vfs";

type Pointer = number;

export class Bridge {
  constructor(
    private io: IO,
    private Module: any,
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

  // public msg_callback(name: MessageName, jsonString: string) {
  public msg_callback(namePtr: Pointer, jsonStringPtr: Pointer) {
    try {
      const name = this.Module.UTF8ToString(namePtr) as MessageName;
      const jsonString = this.Module.UTF8ToString(jsonStringPtr) as string;
      console.log("msg_callback()", name, jsonString)

      const msg = JSON.parse(jsonString);
      this.io.onMessage(name, msg);
    } catch(err) {
      console.error("msg_callback(), JSON parse error:", err)
      throw err;
    }
  }
}
