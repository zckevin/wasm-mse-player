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
  constructor(videoElement, mediaSource, clearMseBuffer) {
    this.videoElement = videoElement;
    this.mediaSource = mediaSource;
    this.outputFile = null;

    this.clearMseBuffer = clearMseBuffer;

    this.wakeupFFmpeg = null;
    this.ffmpegLatestPacketPts = 0;

    // seconds
    this.maxBufferTime = 5;

    // this.videoElement.addEventListener("progress", this.shouldWakeupNow.bind(this));
    this.videoElement.addEventListener(
      "timeupdate",
      this.shouldWakeupNow.bind(this)
    );

    this.videoElement.addEventListener("seeking", () => {
      let seekingBack = false;
      const currentTime = this.videoElement.currentTime;
      if (this.lastVideoTime && this.lastVideoTime > currentTime) {
        seekingBack = true;
        this._has_seeking_back = true;

        this.clearMseBuffer(currentTime);
      }
      this.lastVideoTime = currentTime;
      console.log("ffmepg seeking to ", currentTime);
      this.wakeupFFmpeg(seekingBack);
      this.FFmpegSeek(currentTime, seekingBack);
    });

    // chrome mse is buggy on fragmented-mp4 that seeking forward makes video segments
    // in between bufferd.
    // this.videoElement.addEventListener(
    //   "seeking",
    //   // this.shouldWakeupNow.bind(this)
    //   () => this.wakeupFFmpeg()
    // );
  }

  shouldWakeupNow() {
    try {
      const currentTime = this.videoElement.currentTime;
      if (currentTime > this.lastVideoTime) {
        this.lastVideoTime = currentTime;
      }

      const ranges = new TimeRangesHelper(this.videoElement.buffered);
      const timeAhead = ranges.bufferedTimeAhead(currentTime);

      console.log(`curtime ${currentTime}, timeAhead ${timeAhead}`);
      if (timeAhead < this.maxBufferTime) {
        this.wakeupFFmpeg();
      }
      if (this._has_seeking_back) {
        this.wakeupFFmpeg();
      }
    } catch (err) {
      console.log(err);
    }
  }

  setFFmpegSeek(cb) {
    this.FFmpegSeek = cb;
  }

  setWakeupCallback(cb) {
    this.wakeupFFmpeg = cb;
  }

  pauseDecodeIfNeeded(cur_pkt_seconds) {
    this.ffmpegLatestPacketPts = cur_pkt_seconds;
    this.shouldWakeupNow();
  }
}

export { SimpleMaxBufferTimeController };
