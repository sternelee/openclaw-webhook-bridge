import * as openNextModule from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    const openNextWorker = openNextModule.default;
    return openNextWorker.fetch(request, env, ctx);
  },
};
