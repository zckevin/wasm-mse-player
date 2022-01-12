/**
 * This file is included as JS bindings by emscripten during the build
 * process of FFmpeg
 */
(function() {
  const C_FUNCTION_PREFIX = "wasm_js_";
  const fns = {};

  /**
   * use eval for compile time string interpolation,
   * because emscripten calls functions in LibraryManager.library 
   * without context...
   * 
   * @param {string} __name the prefix is in case collision with arg name in ...args
   * @param {boolean} async 
   */
  function addProxyFn(__name, async) {
    const AsyncExpr = `
      fns[C_FUNCTION_PREFIX + "${__name}"] = function(...args) {
        return Asyncify.handleSleep((wakeUp) => {
          globalThis.bridge["${__name}"](wakeUp, ...args);
        });
      }`;
    const SyncExpr = `
      fns[C_FUNCTION_PREFIX + "${__name}"] = function(...args) {
        globalThis.bridge["${__name}"](...args);
      }`;
    eval(async ? AsyncExpr : SyncExpr);
  }

  addProxyFn("wait_read_result", true);
  addProxyFn("pause_decode", true);
  addProxyFn("msg_callback", false);
  addProxyFn("do_snapshot", false);

  mergeInto(LibraryManager.library, fns);
})();