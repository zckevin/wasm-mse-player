const { Command } = require('commander');
const { WasmTarget } = require("./src/wasm.js");
const { LinuxTarget } = require("./src/linux.js");
const process = require("process");

function loadProcessEnv(config) {
  if (!config.rootDir && process.env.FFMPEG_ROOT_DIR) {
    config.rootDir = process.env.FFMPEG_ROOT_DIR;
  }
}

function getTarget(config) {
  if (config.verbose) {
    console.log(config);
  }
  switch (config.targetName) {
    case "linux":
      return new LinuxTarget(config);
    case "wasm":
      return new WasmTarget(config);
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

const program = new Command();

program
  .version(require("./package.json").version)
  .option('-v, --verbose', 'run verbosely', true)
  .option('-n, --dry-run', 'print command only', false)
  .option('-r, --root-dir <dir>', 'ffmpeg root dir', '')
  .option('--release', 'release build', false)
  .option('-p, --use-pthreads', 'use pthreads', false)

program
  .command('configure')
  .description('configure ffmpeg with specified target')
  .argument('<target>', 'build target', String)
  .action((target, options) => {
    const config = {
      targetName: target,
      ...options,
      ...(program.opts()),
    }
    loadProcessEnv(config);
    getTarget(config).configure();
  });

program
  .command('make')
  .description('build ffmpeg with specified target')
  .argument('<target>', 'build target', String)
  .option('-j, --jobs', 'concurrent jobs', 12)
  .option('--clean', 'run "make clean" before make', false)
  .action((target, options) => {
    if (!options.jobs) {
      options.jobs = 12;
    }
    const config = {
      targetName: target,
      ...options,
      ...(program.opts()),
    }
    loadProcessEnv(config);
    getTarget(config).make();
  });

program
  .command('run')
  .description('run ffmpeg with specified target')
  .option('-g, --gdb', 'run with gdb', false)
  .option('--record', 'record using rr', false)
  .action((options) => {
    const config = {
      targetName: "linux",
      ...options,
      ...(program.opts()),
    }
    loadProcessEnv(config);
    getTarget(config).run();
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
