const timeout = 5000;

describe(
  "http player",
  () => {
    let page;
    beforeAll(async () => {
      page = await global.__BROWSER__.newPage();
      await page.goto(
        "http://localhost:8080/#/http?url=http://localhost:9004/6seconds.mp4"
      );
    }, timeout);

    afterAll(async () => {
      await page.close();
    });

    it("should load without error", async () => {
      const g_config = await page.evaluate(() => g_config);
      console.log(g_config);

      const n = await page.evaluate(
        () => document.querySelectorAll("video").length
      );
      expect(n).toEqual(1);
    });
  },
  timeout
);
