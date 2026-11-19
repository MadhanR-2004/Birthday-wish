import { sculptMandrake } from "./mandrakeShape.js";

// Sculpts the mandrake off the main thread (it takes about a second), and
// hands back the finished arrays.
const { body, arm } = sculptMandrake();
const buffers = [body, arm].flatMap((m) => [m.position.buffer, m.normal.buffer, m.index.buffer, m.color.buffer]);
self.postMessage({ body, arm }, buffers);
