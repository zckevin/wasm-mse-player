const { BuildTarget } = require("./base.js")

const fs = require("fs")
const path = require("path");
const { exec } = require("shelljs")
const safeEval = require("safe-eval")

function getAsyncifyImports() {
  const emscriptenLibPath = path.join(__dirname, "../../emscripten.js")
  const script = fs.readFileSync(emscriptenLibPath, "utf8");
  
  let imports;
  // HACK here: using mocks as the Emscripten Asyncify
  const mockContext = {
    LibraryManager: { library: null },
    mergeInto: (lib, fns) => {
      imports = Object.keys(fns);
    },
  }
  safeEval(script, mockContext);
  return imports;
}

class WasmTarget extends BuildTarget {
  constructor(config) {
    super(config);

    this.extra_ffmpeg_flags = [
      "--target-os=none", // use none to prevent any os specific configurations
      "--arch=x86_32", // use x86_32 to achieve minimal architectural optimization

      "--enable-cross-compile",

      "--disable-x86asm",
      "--disable-inline-asm",
      "--disable-runtime-cpudetect",
      "--disable-programs",

      "--nm=llvm-nm",
      "--ar=emar",
      "--ranlib=emranlib",
      "--cc=emcc",
      "--cxx=em++",
      "--objcc=emcc",
      "--dep-cc=emcc",
    ]

    this.emscripten_flags = [
      "-Qunused-arguments",
      "-I.",
      "-L./libavcodec -L./libavformat -L./libswresample -L./libavutil -L./libavfilter -L./libavdevice -L./libswscale",
	    "-lavformat -lavutil -lavcodec -lswresample -lavfilter -lavdevice -lswscale",
	    "fftools/ffmpeg_opt.c fftools/ffmpeg_filter.c fftools/ffmpeg_hw.c fftools/cmdutils.c fftools/ffmpeg.c",
      // "fftools/cJSON.c fftools/wasm.c",
      '--js-library ../emscripten.js',

      '-s INVOKE_RUN=0', // do not run main() at the beginning
      '-s EXPORTED_FUNCTIONS="[_main, _malloc]"',
      '-s EXPORTED_RUNTIME_METHODS="[FS, ccall, cwrap, writeAsciiToMemory, setValue, lengthBytesUTF8, stringToUTF8, UTF8ToString, addFunction, allocate, intArrayFromString, ALLOC_NORMAL]"',

      `-s ASYNCIFY_IMPORTS="[${getAsyncifyImports().join(", ")}]"`,
      '-s ASYNCIFY',
      '-s ASYNCIFY_STACK_SIZE=300000',

      '-s INITIAL_MEMORY=134217728', // 128 MiB
      '-s ALLOW_MEMORY_GROWTH=0',
      '-s ALLOW_TABLE_GROWTH=1', // for Module.addFunction()
      '-s EXIT_RUNTIME=1',

      "-s MODULARIZE -s EXPORT_ES6=1 -s ENVIRONMENT='web,worker'",
      "-o /run/media/sb/hdd/wasm-mse-player/wasm/ffmpeg.js",
    ];

    if (this.config.debugBuild) {
      this.cflags.push("-s -O0");
      this.emscripten_flags.unshift("-g");
    } else {
      this.cflags.push("-s -Oz");
      this.emscripten_flags.unshift("-Oz");
    }

    if (this.config.usePthreads) {
      this.ldflags.push("-s USE_PTHREADS=1");
      this.emscripten_flags.unshift("-pthread -s USE_PTHREADS=1 -s PROXY_TO_PTHREAD=1 -s PTHREADS_DEBUG=1");
    }
  }

  make() {
    super.make();

    const cmd = [
      "emcc -v",
      ...this.emscripten_flags,
    ]
    this._run(cmd);
  }
}

module.exports = {
  WasmTarget,
};
