<template>
  <div>
    <ul id="main">
      <li><router-link to="/file">File</router-link></li>
      <li><router-link to="/http">HTTP</router-link></li>
      <li><router-link to="/webtorrent">Webtorrent</router-link></li>
    </ul>
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: "App",
  components: {},
};
</script>