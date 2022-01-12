import { WasmWorkerLoader } from "./worker-loader"
import { Mp4Atom } from "../worker/mp4-parser";
import { IO, ReadFn, JSONObject, MessageName } from "./io"
import { MaxBufferTimeController } from "./controller";

import EventEmitter from "eventemitter3";

class MsePlayerIO extends EventEmitter implements IO {
  protected atoms: Array<Mp4Atom> = [];
  protected codec: string;
  protected duration: number;

  constructor(public read: ReadFn) {
    super();
  }

  public onNewAtom(atom: Mp4Atom) {
    this.atoms.push(atom);
  }

  public onMessage(name: MessageName, msg: JSONObject) {
    if (name == "meta_info") {
      if (!msg.duration || !msg.codec) {
        throw new Error(`onMessage(): Empty meta_info, ${JSON.stringify(msg)}`)
      }
      this.duration = msg.duration as number;
      this.codec = `video/mp4; codecs="${msg.codec as string}, mp4a.40.2"`;
      this.emit("onMetaInfo");
    }
  }

  public onFFmpegPaused(pkt_pts: number, is_eof: number) {
    // @ts-ignore
    this.controller.onFFmpegPaused(pkt_pts, is_eof);
  }

  public onSeek() {
    this.atoms = [];
  }
}

export class MsePlayer extends MsePlayerIO {
  private mediaSource: MediaSource;
  private sb: SourceBuffer;
  private loopInterval: any;

  private controller: MaxBufferTimeController;

  constructor(
    read: ReadFn,
    private file_size: number,
    private videoElement: HTMLVideoElement,
  ) {
    super(read);

    const worker = new WasmWorkerLoader(this.file_size, this);
    this.controller = new MaxBufferTimeController(
      10,
      worker.wrapped_worker,
      videoElement,
    );

    this.once("onMetaInfo", () => {
      this.startPlaying();
    });
  }

  private serializeAtom(atom: Mp4Atom): Uint8Array {
    const ab = new ArrayBuffer(atom.length);

    // size
    const dv = new DataView(ab);
    dv.setUint32(0, atom.length);
    // atom type
    for (let i = 0; i < 4; i++) {
      dv.setUint8(4 + i, atom.atom_type[i].charCodeAt(0));
    }
    // atom data
    const view = new Uint8Array(ab);
    view.set(atom.data.buf, 8);

    return view;
  }

  private drainAtoms(start: number, end: number) {
    let counter = 0;
    const views = this.atoms.splice(start, end).map(atom => {
      const view = this.serializeAtom(atom);
      counter += view.byteLength;
      return view;
    });

    let pos = 0;
    const concated = new Uint8Array(counter);
    views.map((view) => {
      concated.set(view, pos);
      pos += view.byteLength;
    });

    this.sb.appendBuffer(concated);
  }

  private appendAtoms() {
    if (this.sb.updating) {
      return;
    }
    const atoms = this.atoms;
    if (atoms.length >= 4) {
      if (
        atoms[0].atom_type === "ftyp" &&
        atoms[1].atom_type === "moov" &&
        atoms[2].atom_type === "moof" &&
        atoms[3].atom_type === "mdat"
      ) {
        console.log("appendAtoms(): append init ftyp/moov");
        this.drainAtoms(0, 4);
        return;
      }
    }
    if (atoms.length >= 2) {
      if (
        atoms[0].atom_type === "moof" &&
        atoms[1].atom_type === "mdat"
      ) {
        this.drainAtoms(0, 2);
        console.log("appendAtoms(): append a moof/mdat");
        return;
      }
      if (
        atoms[0].atom_type === "moof" &&
        atoms[1].atom_type === "moof"
      ) {
        atoms.shift();
        console.log("appendAtoms(): shift a unused moof fragment because of seeking");
        return;
      }
    }
  }

  private async startPlaying() {
    await new Promise((resolve, reject) => {
      this.mediaSource = new MediaSource();
      const url = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener("sourceopen", () => {
        URL.revokeObjectURL(url);
        resolve(null);
      });
      this.videoElement.src = url;
    });

    this.mediaSource.duration = this.duration;
    this.sb = this.mediaSource.addSourceBuffer(this.codec);
    this.loopInterval = setInterval(() => {
      this.appendAtoms();
    }, 500);

    this.videoElement.controls = true;
    this.videoElement.muted = true;
    this.videoElement.play();
  }
}
