// generate(): the per-minute Gemini limit waits for a free slot.

function loadApp(rpm) {
  let loaded;

  process.env.GEMINI_RPM = String(rpm);

  jest.isolateModules(() => {
    const { internals } = require("../../app");
    const { generateContent } = require("@google/genai");

    loaded = { generate: internals.generate, generateContent };
  });

  process.env.GEMINI_RPM = "1000";

  return loaded;
}

afterEach(() => {
  jest.useRealTimers();
});

test("passes the model and parameters to Gemini", async () => {
  const { generate, generateContent } = loadApp(5);

  generateContent.mockResolvedValueOnce({ text: "ok" });

  await expect(generate({ contents: "hello" })).resolves.toEqual({ text: "ok" });
  expect(generateContent).toHaveBeenCalledWith({
    model: "gemini-3.5-flash-lite",
    contents: "hello"
  });
});

test("calls over the limit wait until the oldest call is a minute old", async () => {
  jest.useFakeTimers();

  const { generate, generateContent } = loadApp(2);

  await generate({ contents: "1" });
  await generate({ contents: "2" });

  let done = false;
  const third = generate({ contents: "3" }).then(() => {
    done = true;
  });

  await jest.advanceTimersByTimeAsync(59000);
  expect(done).toBe(false);
  expect(generateContent).toHaveBeenCalledTimes(2);

  await jest.advanceTimersByTimeAsync(1100);
  await third;
  expect(done).toBe(true);
  expect(generateContent).toHaveBeenCalledTimes(3);
});

test("calls older than a minute no longer count", async () => {
  jest.useFakeTimers();

  const { generate, generateContent } = loadApp(1);

  await generate({ contents: "1" });
  await jest.advanceTimersByTimeAsync(61000);

  // Runs at once: the first call has left the window.
  await generate({ contents: "2" });
  expect(generateContent).toHaveBeenCalledTimes(2);
});
