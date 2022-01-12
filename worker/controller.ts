
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
  constructor(
    private maxBufferTime: number, // seconds
    private videoElement: HTMLVideoElement,
    private mediaSource: MediaSource,
    private worker: any,
  ) {
    this.videoElement.addEventListener("timeupdate", () => {
      this.shouldWakeupNow();
    });

    this.videoElement.addEventListener("seeking", () => {
      const currentTime = this.videoElement.currentTime;
      console.log("ffmepg seeking to ", currentTime);
      this.worker.Seek(currentTime);
    });

    // chrome mse is buggy on fragmented-mp4 that seeking forward makes video segments
    // in between bufferd.
    this.videoElement.addEventListener("seeking", () => {
      this.worker.Wakeup();
    });
  }

  private shouldWakeupNow() {
    try {
      const currentTime = this.videoElement.currentTime;
      const ranges = new TimeRangesHelper(this.videoElement.buffered);
      const timeAhead = ranges.bufferedTimeAhead(currentTime);

      console.log(`curtime ${currentTime}, timeAhead ${timeAhead}`);
      if (timeAhead < this.maxBufferTime) {
        this.worker.Wakeup();
      }
    } catch (err) {
      console.log(err);
    }
  }
}
