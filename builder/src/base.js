const { exec } = require("shelljs")
const process = require('process');
const child_process = require('child_process');
const fs = require("fs");
const path = require("path");

class BuildTarget {
  constructor(config) {
    this.config = config;

    this.ffmpeg_flags = [
      "--disable-everything",
      "--disable-doc",

      "--enable-protocol=file",

      "--enable-demuxer=matroska,mov",
      "--enable-muxer=mov",

      "--enable-decoder=h264,mp3,ac3,eac3,vorbis,opus,aac",
      "--enable-encoder=aac",

      "--enable-filter=null,anull,pad,apad,tpad,buffer,buffersink,aformat,format,overlay",
      "--enable-filter=aresample",  // for -channel_layout FC
    ];
    this.cflags = [];
    this.ldflags = [];
  }

  _run(cmd) {
    if (this.config.verbose)  {
      console.log(cmd);
    }
    if (this.config.dryRun) {
      console.log(cmd.join(" "));
      return;
    }

    if (this.config.rootDir) {
      process.chdir(this.config.rootDir);
    }

    if (this.config.record) {
      return exec(`rr record ${cmd.join(" ")}`);
    }

    // shelljs doesn't support interactive process
    // https://github.com/shelljs/shelljs/issues/424
    if (this.config.gdb) {
      const s = ["gdb --args", ...cmd].join(" ");
      child_process.execSync(`zsh -i -c '${s}'`, {stdio: 'inherit'});
    }
    
    exec(cmd.join(" "));
  }

  configure() {
    if (this.config.debugBuild) {
      this.ffmpeg_flags.push("--enable-debug=3 --disable-stripping");
    } else {
      this.ffmpeg_flags.push("--disable-debug --enable-stripping");
    }

    if (this.config.usePthreads) {
      this.ffmpeg_flags.push("--enable-pthreads");
    }

    const ffmpeg_flags = this.ffmpeg_flags.concat(this.extra_ffmpeg_flags || [], [
      `--extra-cflags="${this.cflags.join(" ")}"`,
      `--extra-cxxflags="${this.cflags.join(" ")}"`,
      `--extra-ldflags="${this.ldflags.join(" ")}"`,
    ]);

    const cmd = ["./configure", ...ffmpeg_flags];
    this._run(cmd);
  }

  clean() {
    const cmd = ["make", "clean"];
    this._run(cmd);
  }

  make() {
    if (this.config.clean) {
      this.clean();
    }
    const cmd = ["make", `-j${this.config.jobs}`];
    if (this.config.targetName === "wasm") {
      cmd.unshift("emmake");
    }
    this._run(cmd);
  }

  run() {
    const binaryPath = ["ffmpeg_g"];
    if (this.config.rootDir) {
      binaryPath.unshift(this.config.rootDir);
    }
    fs.access(path.join(...binaryPath), (err) => {
      if (err) {
        throw err;
      }
      const cmd = [path.join(...binaryPath), ...this.run_flags]
      this._run(cmd);
    })
  }
}

module.exports = {
  BuildTarget,
};
