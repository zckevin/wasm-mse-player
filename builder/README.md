## Basic usage

```bash
# 1. add Emscripten to your PATH
export PATH=$PATH:/home/user/emsdk/upstream/emscripten

# 2. set ffmpeg root dir
export FFMPEG_ROOT_DIR=/home/user/FFmpeg-chrome-mse

# 3. configure ffmpeg wasm
./builder/bin/ffbuilder configure wasm

# 4. build ffmpeg wasm
./builder/bin/ffbuilder build wasm
```

## Run ffmpeg linux

```bash
./builder/bin/ffbuilder run linux

# using gdb
./builder/bin/ffbuilder run linux --gdb

## record using Mozilla rr
./builder/bin/ffbuilder run linux --record
```

## Other flags

```
--dry-run
--clean
--release
```