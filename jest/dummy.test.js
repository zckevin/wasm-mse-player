const timeout = 5000

describe(
  '/ (Home Page)',
  () => {
    let page
    beforeAll(async () => {
      page = await global.__BROWSER__.newPage()
      await page.goto("http://localhost:8080")
    }, timeout)

    afterAll(async () => {
      await page.close()
    })

    it('should load without error', async () => {
      let n = await page.evaluate(() => document.querySelectorAll("video").length)
      expect(n).toEqual(2)
    })
  },
  timeout
)
