import * as Comlink from "comlink"
import { WasmWorker } from "../worker/worker"
import { FragmentInfoMsg } from "./io"
import { MsePlayer } from "./player"

class TimeRangesHelper {
  private ranges: Array<[number, number]> = [];

  constructor(rangesObj: TimeRanges | FragmentInfoMsg[]) {
    if (rangesObj instanceof TimeRanges) {
      for (let i = 0; i < rangesObj.length; i++) {
        this.ranges.push([rangesObj.start(i), rangesObj.end(i)]);
      }
    } else {
      const ranges: (typeof this.ranges) = [];
      rangesObj.map(range => {
        ranges.push([range.from_seconds, range.to_seconds]);
      })
      this.ranges = this.mergeRanges(ranges);
    }
  }

  private mergeRanges(ranges: Array<[number, number]>) {
    if (!(ranges && ranges.length)) {
      return [];
    }

    // Stack of final ranges
    const stack: Array<[number, number]> = [];

    // Sort according to start value
    ranges.sort(function(a, b) {
      return a[0] - b[0];
    });

    // Add first range to stack
    stack.push(ranges[0]);

    ranges.slice(1).forEach(function(range, i) {
      var top = stack[stack.length - 1];

      if (top[1] < range[0]) {
        // No overlap, push range onto stack
        stack.push(range);
      } else if (top[1] < range[1]) {
        // Update previous range
        top[1] = range[1];
      }
    });

    return stack;
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
  }
  private emittedFragments: FragmentInfoMsg[] = [];

  constructor(
    private maxBufferTime: number, // seconds
    private workerWrapper: Comlink.Remote<WasmWorker>,
    private videoElement: HTMLVideoElement,
    private player: MsePlayer,
  ) {
    this.videoElement.addEventListener("timeupdate", () => {
      this.tryWakeupNow();
    });

    this.videoElement.addEventListener("seeking", () => {
      const currentTime = this.videoElement.currentTime;
      // const ranges = new TimeRangesHelper(this.videoElement.buffered);
      const ranges = new TimeRangesHelper(this.emittedFragments);
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
      // const ranges = new TimeRangesHelper(this.emittedFragments);
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

  private hasZeroStartFragment = false;

  public onFragmentInfo(msg: FragmentInfoMsg) {
    if (msg.from_seconds === 0) {
      if (this.hasZeroStartFragment) {
        return;
      }
      this.hasZeroStartFragment = true;
    }
    this.emittedFragments.push(msg);
  }
}
