"use strict";

class TimeRangesHelper {
  constructor(rangesObj) {
    this.ranges = [];
    for (let i = 0; i < rangesObj.length; i++) {
      this.ranges.push([rangesObj.start(i), rangesObj.end(i)]);
    }
  }

  _iterateRange(t, cb) {
    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i];
      // inclusive
      if (t >= range[0] && t <= range[1]) {
        cb(range[0], range[1]);
        return;
      }
    }
  }

  inRange(t) {
    let result = false;
    const cb = () => {
      result = true;
    };
    this._iterateRange(t, cb);
    return result;
  }

  bufferedTimeAhead(t) {
    let timeAhead = 0;
    const cb = (startTime, endTime) => {
      timeAhead = endTime - t;
    };
    this._iterateRange(t, cb);
    return timeAhead;
  }
}

class SimpleMaxBufferTimeController {
  constructor(videoElement, mediaSource) {
    this.videoElement = videoElement;
    this.mediaSource = mediaSource;
    this.outputFile = null;

    this.wakeupFFmpeg = null;
    this.ffmpegLatestPacketPts = 0;

    // seconds
    this.maxBufferTime = 10;

    // The progress event is fired periodically as the browser loads a resource
    this.videoElement.addEventListener("progress", this.shouldWakeupNow);
    this.videoElement.addEventListener("seeking", this.shouldWakeupNow);
  }

  shouldWakeupNow() {
    const currentTime = this.videoElement.currentTime;
    const ranges = new TimeRangesHelper(this.videoElement.buffered);
    const timeAhead = ranges.bufferedTimeAhead(currentTime);

    if (timeAhead < this.maxBufferTime && this.wakeupFFmpeg) {
      this.wakeupFFmpeg();
      this.wakeupFFmpeg = null;
    }
  }

  pauseDecodeIfNeeded(wakeup, cur_pkt_seconds) {
    this.wakeupFFmpeg = wakeup;
    this.ffmpegLatestPacketPts = cur_pkt_seconds;
    this.shouldWakeupNow();
  }
}

export { SimpleMaxBufferTimeController };
