import { WasmWorker } from "../worker/worker"
import * as Comlink from "comlink"

class TimeRangesHelper {
  private ranges: Array<[number, number]> = [];

  constructor(rangesObj: TimeRanges) {
    for (let i = 0; i < rangesObj.length; i++) {
      this.ranges.push([rangesObj.start(i), rangesObj.end(i)]);
    }
  }

  private iterateRange(
    t: number,
    cb: (startTime: number, endTime: number) => void
  ) {
    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      // inclusive
      if (t >= range[0] && t <= range[1]) {
        cb(range[0], range[1]);
        return;
      }
    }
  }

  public inRange(t: number) {
    let result = false;
    const cb = () => {
      result = true;
    };
    this.iterateRange(t, cb);
    return result;
  }

  public bufferedTimeAhead(t: number) {
    let timeAhead = 0;
    const cb = (startTime: number, endTime: number) => {
      timeAhead = endTime - t;
    };
    this.iterateRange(t, cb);
    return timeAhead;
  }
}

export class MaxBufferTimeController {
  private ffmpeg: {
    pktTimestamp: number,
    // wakeup: () => void,
  }

  constructor(
    private maxBufferTime: number, // seconds
    private workerWrapper: Comlink.Remote<WasmWorker>,
    public videoElement: HTMLVideoElement,
    // private mediaSource: MediaSource,
  ) {
    this.videoElement.addEventListener("timeupdate", () => {
      this.tryWakeupNow();
    });

    this.videoElement.addEventListener("seeking", () => {
      const currentTime = this.videoElement.currentTime;

      const ranges = new TimeRangesHelper(this.videoElement.buffered);
      const timeAhead = ranges.bufferedTimeAhead(currentTime);
      if (timeAhead <= 0) {
        console.log("MaxBufferTimeController, seeking to", currentTime);
        this.workerWrapper.seek(currentTime);
      }
    });
  }

  private tryWakeupNow() {
    if (this.ifWakeupNow()) {
      const should_exit = 0;
      this.workerWrapper.wakeup(should_exit);
    }
  }

  private ifWakeupNow() {
    try {
      const currentTime = this.videoElement.currentTime;
      const ranges = new TimeRangesHelper(this.videoElement.buffered);
      const timeAhead = ranges.bufferedTimeAhead(currentTime);

      console.log(`ifWakeupNow(): curtime ${currentTime}, timeAhead ${timeAhead}`);
      if (timeAhead < this.maxBufferTime) {
        return true;
      }
    } catch (err) {
      console.error("ifWakeupNow(): ", err);
    }
    return false;
  }

  public onFFmpegPaused(pkt_pts: number, is_eof: number) {
    this.ffmpeg = {
      pktTimestamp: pkt_pts,
    }
    this.tryWakeupNow();
  }
}
