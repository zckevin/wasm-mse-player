<template>
  <div>
    type: {{ name }}
    <div v-if="name === 'file'">
      <input
        type="file"
        id="file-selector"
        accept=".mkv, .mp4, .webm"
        @change="onFileLoad"
      />
    </div>
    <div v-if="name !== 'file'">
      <label for="name">video addr</label>
      <input type="text" v-on:keyup.enter="onEnter" name="name" size="10" />
    </div>
    <video width="480"></video>
    <canvas id="buffered-ranges" width="480" height="20"></canvas>
  </div>
</template>

<script>
import initLocalFilePlayer from "../players/local-file.js";
import initHttpPlayer from "../players/http.js";

export default {
  name: "Player",
  props: ["name"],
  methods: {
    onFileLoad(event) {
      const file = event.target.files.item(0);
      const reader = new FileReader();
      reader.onload = function () {
        initLocalFilePlayer(reader.result);
      };
      reader.readAsArrayBuffer(file);
    },

    onEnter(event) {
      if (this.name === "http") {
        console.log(event.target.value);
        initHttpPlayer(event.target.value);
      }
    },
  },
  mounted() {
    if (this.name === "http" && this.$route.query.url) {
      console.log(this.$route.query.url);
      initHttpPlayer(this.$route.query.url);
    }

    const myCanvas = document.getElementById("buffered-ranges");
    const context = myCanvas.getContext("2d");
    context.fillStyle = "lightgray";
    context.fillRect(0, 0, myCanvas.width, 20);
    context.fillStyle = "red";
  },
};
</script>