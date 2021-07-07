<template>
  <video width="480"></video>
  <div>
    <input
      type="file"
      id="file-selector"
      accept=".mkv, .mp4, .webm"
      @change="onFileLoad"
    />
  </div>
  <div>
    <label for="name">video addr</label>
    <input type="text" id="video-addr" name="name" size="10" />
  </div>
</template>

<script>
import runLocalFilePlayer from "../players/local-file.js";

export default {
  name: "Player",
  methods: {
    onFileLoad(event) {
      const file = event.target.files.item(0);
      const reader = new FileReader();
      reader.onload = function () {
        runLocalFilePlayer(reader.result);
      };
      reader.readAsArrayBuffer(file);
    },
  },
};
</script>