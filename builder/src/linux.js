const { BuildTarget } = require("./base.js")
const path = require("path");

class LinuxTarget extends BuildTarget {
  constructor(config) {
    super(config);

    this.extra_ffmpeg_flags = [
      "--disable-ffprobe",
      "--disable-ffplay",
    ]

    this.run_flags = [
      // confirm on file overwitten
      "-y",
      // disable interaction on standard input
      "-nostdin",
      "-loglevel info",
      `-i ${path.join(__dirname, "../../video_samples/Amaze-Dolby-thedigitaltheater.mp4")}`,
      // video codec copy, audio codec to AAC LC
      "-c:v copy -c:a aac",
      // configure AAC channel info, without it MSE may throw errro
      "-channel_layout stereo",
      // generate Fmp4
      "-movflags frag_keyframe+empty_moov+default_base_moof",
      // max moov+moof size: 1MB
      "-frag_size 1000000",
      // min moov+moof duration: 0.5 seconds
      // "-min_frag_duration 500000",
      // max fragment duration 1000ms
      // "-frag_duration 1000",
      // output container format MP4/MOV
      "-f mov",
      "/tmp/output.mp4",
    ]
  }
}

module.exports = {
  LinuxTarget,
};
