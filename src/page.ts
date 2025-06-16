import { Page } from "puppeteer";

export class BonusPage {
  url = "https://www.ah.nl/bonus";

  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(this.url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  }

  async waitForPromotionCards(): Promise<void> {
    await this.page.waitForSelector('[data-testhook="promotion-card"]');
  }

  async acceptTerms() {
    const selector = '[data-testhook="accept-cookies"]';
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  async selectNextWeek() {
    await this.page.click('[data-testhook="period-toggle-button"]');
    await this.page.click('[data-testhook="period-toggle-item"]:nth-child(2)');
  }

  async extractBonusGroups(): Promise<string[]> {
    return await this.page.evaluate(async () => {
      const result: string[] = [];
      const elements = Array.from(
        document.querySelectorAll('[data-testhook="promotion-card"]')
      );

      for (const element of elements) {
        // Click to open the product panel for the promotion group
        const card = element as HTMLAnchorElement;
        card.click();

        // Wait for the product panel to appear
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            const panel = document.querySelector(
              '[data-testhook="panel-body"]'
            );
            const products = panel?.querySelectorAll(
              '[href^="/producten/product/"]'
            );
            if (products?.length) {
              clearInterval(interval);
              resolve(true);
            }
          }, 50);
        });

        // Find all product cards with product hrefs
        const products = document.querySelectorAll(
          '[href^="/producten/product/"]'
        );

        // Extract product IDs from the href attributes
        const productIds = Array.from(products).map(({ href }: any) => {
          const match = href.match(/\/wi(\d+)(?:\/|$)/);
          return match ? match[1] : "";
        });

        result.push(...productIds);

        // Click to close the product panel
        const button = document.querySelector(
          '[data-testhook="panel-header-close-button"]'
        ) as HTMLElement;
        button?.click();
      }

      return result;
    });
  }
}
