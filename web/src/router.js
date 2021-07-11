import { createWebHashHistory, createRouter } from "vue-router";
import Player from "./components/Player.vue";

const routes = [
  {
    path: "/",
    redirect: "/file",
  },
  {
    path: "/:name",
    component: Player,
    props: true,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
