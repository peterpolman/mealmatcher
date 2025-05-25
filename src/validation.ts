import puppeteer, { Page } from "puppeteer";
import { Meal, Product, WeekDay } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

class BonusPage {
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

  async extractBonusGroups(): Promise<string[]> {
    return await this.page.evaluate(async () => {
      const result: string[] = [];

      const buttonClose = () =>
        document.querySelector(
          '[data-testhook="panel-header-close-button"]'
        ) as HTMLAnchorElement;

      const elements = Array.from(
        document.querySelectorAll('[data-testhook="promotion-card"]')
      );

      for (const element of elements) {
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
        const products = document.querySelectorAll(
          '[href^="/producten/product/"]'
        );
        const productIds = Array.from(products).map(({ href }: any) => {
          const match = href.match(/\/wi(\d+)(?:\/|$)/);
          return match ? match[1] : "";
        });

        result.push(...productIds);

        buttonClose()?.click();
      }

      return result;
    });
  }
}
/**
 * Fetch the bonus products from the AH website.
 * It launches a Puppeteer browser instance, navigates to the bonus page,
 * waits for the promotion cards to load, and extracts the product IDs of the bonus products.
 *
 * @returns An array of product IDs that are currently discounted as bonus products.
 */
export const fetchBonusProducts = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);

  const bonusPage = new BonusPage(page);
  await bonusPage.goto();
  await bonusPage.waitForPromotionCards();

  const bonusProducts = await bonusPage.extractBonusGroups();
  await browser.close();

  return bonusProducts;
};

/**
 * Get the required products for a meal based on the day and meal details.
 * It filters the products based on the meal slug and calculates the required quantity
 * based on the number of people for the day and the meal.
 *
 * @param day - The day of the week for which the meal is planned.
 * @param meal - The meal details including slug, preparation time, and number of people.
 * @param products - The list of products available.
 * @param options - Additional options to determine if leftovers are valid.
 * @returns An array of products required for the meal with updated quantities.
 */
const getRequiredProductsForMeal = (
  day: WeekDay,
  meal: Meal,
  products: Product[],
  options: { isMealLeftoverValid: boolean }
) =>
  products
    // Filter the required products for this meal
    .filter((p) => p.Meal === meal.Slug)
    // Determine multipler by dividing Meal.NumberOfPeople by the number of people for the day
    .map((p) => {
      const multiplier = Math.ceil(
        (options.isMealLeftoverValid
          ? day.NumberOfPeople + day.NumberOfPeopleLeftovers
          : meal.NumberOfPeople) / meal.NumberOfPeople
      );
      return {
        ...p,
        // Update quantity based on the number of people for the day
        Quantity: p.Quantity * multiplier,
      };
    });

/**
 * Check if the meal's preparation time is valid for the given day.
 * The meal's preparation time must not exceed the maximum allowed preparation time for the day.
 *
 * @param meal - The meal to check.
 * @param day - The day of the week for which the meal is planned.
 * @returns True if the meal's preparation time is valid, false otherwise.
 */
export const isPreparationTimeValid = (meal: Meal, day: WeekDay) =>
  meal.PreparationTimeMinutes <= day.MaxPreparationTime;

/**
 * Check if the meal is valid for leftovers based on the day of the week.
 * On Sunday, the meal must support leftovers and there must be people to eat them.
 * On other days, the meal can be any meal that supports leftovers.
 *
 * @param day - The day of the week for which the meal is planned.
 * @param meal - The meal to check.
 * @returns True if the meal is valid for leftovers, false otherwise.
 */
export const isMealLeftoverValid = (day: WeekDay, meal: Meal) =>
  day.Day !== "Sunday" ||
  (day.NumberOfPeopleLeftovers > 0 && meal.CanBeLeftovers);

/**
 * Check if the required product discounts are valid.
 * It checks if there are any products that are required for the meal
 * that are marked as bonus required but are not included in the list of bonus product IDs.
 *
 * @param productsRequired - The list of products required for the meal.
 * @param bonusProductIds - The list of product IDs that are currently discounted.
 * @returns True if there are required products that are not in the bonus product IDs, false otherwise.
 */
export const isRequiredProductDiscountsValid = (
  productsRequired: Product[],
  bonusProductIds: string[]
) => {
  return productsRequired.some(
    (p: Product) =>
      p.IsBonusRequired && !bonusProductIds.includes(p.ID.toString())
  );
};

/**
 * Check if the product shelf life is valid for the given date.
 * It checks if the maximum shelf life in days for each required product
 * is sufficient based on the day of the week and the delivery date.
 */
export const isProductShelfLifeValid = (
  productsRequired: Product[],
  date: string
) => {
  const deliveryDayInWeek = 2; // Example: Tuesday
  const d = new Date(date);
  const day = d.getDay();
  const dayInWeek = day === 0 ? 7 : day;

  return productsRequired.every((p) => {
    return p.MaxShelfLifeInDays >= dayInWeek - deliveryDayInWeek;
  });
};

/**
 * Pick meals for the week based on the given rules and conditions.
 * It filters the meals based on preparation time, leftover validity, and required product discounts.
 * It returns a plan for the week with the selected meals.
 *
 * @param meals - The list of available meals.
 * @param bonusProductIds - The list of product IDs that are currently discounted.
 * @param products - The list of available products.
 * @param weekPlan - The plan for the week with days and their details.
 * @returns An array of selected meals for each day of the week.
 */
export const matchMeals = (
  meals: Meal[],
  bonusProductIds: string[],
  products: Product[],
  weekPlan: WeekDay[]
) => {
  const plan = [];

  for (const day of weekPlan) {
    const matches = meals
      // 1. Match meals that fit the criteria for the day
      .filter((meal: Meal) => {
        // Get required products for the meal
        const productsRequired = getRequiredProductsForMeal(
          day,
          meal,
          products,
          {
            isMealLeftoverValid: isMealLeftoverValid(day, meal),
          }
        );

        return (
          // 1.1. Check if meal prep time exceeds the maximum allowed for the day
          isPreparationTimeValid(meal, day) &&
          // 1.2: On Sunday, must support leftovers, other days can be any meal
          isMealLeftoverValid(day, meal) &&
          // 1.3: If products have required discounts, check if they are currently discounted
          isRequiredProductDiscountsValid(productsRequired, bonusProductIds) &&
          // 1.4: Check if the shelf life for the products is sufficient for this day
          isProductShelfLifeValid(productsRequired, day.Date)
        );
      })
      // 2. Score the meals based on the number of bonus products required
      .map((meal) => {
        // Get required products for the meal
        const productsRequired = getRequiredProductsForMeal(
          day,
          meal,
          products,
          {
            isMealLeftoverValid: isMealLeftoverValid(day, meal),
          }
        );
        // Filter products that are required and also discounted
        const productsDiscounted = productsRequired.filter((p: Product) =>
          bonusProductIds.includes(p.ID.toString())
        );

        return {
          meal,
          score: productsDiscounted.length,
        };
      })
      // 3. Sort meals descending by the number of discounted products
      .sort((a, b) => b.score - a.score);

    plan.push(matches.length > 0 ? matches[0].meal : null);
  }

  return plan;
};
