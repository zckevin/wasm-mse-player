import { MsePlayer } from "../src/main/player"

// load jpeg using webpack file-loader
import videoSampleFileUrl from "../video_samples/sample_1280x720_surfing_with_audio.mkv"

async function init() {
  const videoElement = document.createElement("video");
  videoElement.style.width = "640px";
  document.body.appendChild(videoElement);

  const ab = await (await fetch(videoSampleFileUrl)).arrayBuffer();
  return { el: videoElement, ab }
}

async function run() {
  const { el, ab } = await init();
  const readFn = (pos, length) => {
    const usedLength = Math.min(512 * 1024, length);
    return Promise.resolve(ab.slice(pos, pos + usedLength));
  }
  const player = new MsePlayer(
    readFn,
    ab.byteLength,
    el,
  )
  console.log(player)
}
run();