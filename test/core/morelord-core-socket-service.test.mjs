import assert from "node:assert/strict";
import test from "node:test";

test("a Core channel can register before the transport reports ready", async () => {
  const expected = Object.freeze({ namespace: "morelord-journeys" });
  globalThis.game = {
    modules: new Map([["morelord-core", {
      api: {
        socket: {
          ready: false,
          createChannel: namespace => ({ ...expected, namespace })
        }
      }
    }]])
  };

  const { getMorelordSocketChannel } = await import("../../scripts/core/morelord-core-socket-service.mjs?startup-test");
  assert.deepEqual(getMorelordSocketChannel(), expected);
  delete globalThis.game;
});
