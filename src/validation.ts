import fs from "fs";
import { google } from "googleapis";
import path from "path";
import puppeteer from "puppeteer";
import { BonusPage } from "./page";
import { Meal, Product, WeekDay } from "./types";

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../config/credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/**
 * Convert a 2D array of CSV rows into an array of JSON objects.
 * The first row is treated as headers, and each subsequent row is converted into an object
 * with keys from the headers and values from the row.
 * @param rows - A 2D array where the first row contains headers and subsequent rows contain data.
 * @returns An array of objects representing the rows, with keys from the headers.
 */
const CSV2JSON = (rows: any[][]) => {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const boolMap: Record<string, boolean> = { TRUE: true, FALSE: false };
  return rows.slice(1).map((row) =>
    headers.reduce((obj, header, i) => {
      obj[header] = row[i] ? boolMap[row[i]] ?? row[i] : "";
      return obj;
    }, {})
  );
};

/**
 * Fetch data from a Google Sheets spreadsheet.
 * @param spreadsheetId - The ID of the spreadsheet to fetch data from.
 * @param range - The range of cells to fetch data from, e.g., "Sheet1!A1:C10".
 * @returns An array of objects representing the rows in the specified range.
 */
export const fetchSheet = async (spreadsheetId: string, range: string) => {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values ? CSV2JSON(res.data.values) : [];
};

/**
 * Sort the week by preparation time in ascending order.
 * It modifies the week array in place and returns it.
 *
 * @param week - The array of WeekDay objects representing the week.
 * @returns The sorted week array.
 */
export const sortWeekByPreparationTime = (week: WeekDay[]) => {
  week.sort((a, b) => a.MaxPreparationTime - b.MaxPreparationTime);
  return week;
};

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
  await bonusPage.acceptTerms();
  await bonusPage.selectNextWeek();
  await bonusPage.waitForPromotionCards();

  const bonusProducts = await bonusPage.extractBonusGroups();
  await browser.close();

  // Write to disk as json data
  fs.writeFileSync(
    path.resolve(__dirname, "./data/bonus.json"),
    JSON.stringify(bonusProducts)
  );

  return bonusProducts;
};

/**
 * Get the required products for a meal based on the day and meal details.
 * It filters the products based on the meal slug and calculates the required quantity
 * based on the number of people for the day and the meal.
 *
 * @param day - The day of the week for which the meal is planned.
 * @param meal - The meal details including slug, preparation time, and number of people.
 * @param ingredients - The list of required products.
 * @param options - Additional options to determine if leftovers are valid.
 * @returns An array of products required for the meal with updated quantities.
 */
const getRequiredProductsForMeal = (
  day: WeekDay,
  meal: Meal,
  ingredients: Product[],
  options: { isMealLeftoverValid: boolean }
) => {
  // Determine multipler by dividing Meal.NumberOfPeople by the number of people for the day
  return ingredients.map((p) => {
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
};

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
 * @param ingredients - The list of products required for the meal.
 * @param bonusProductIds - The list of product IDs that are currently discounted.
 * @returns True if there are required products that are not in the bonus product IDs, false otherwise.
 */
export const isRequiredProductDiscountsValid = (
  ingredients: Product[],
  bonusProductIds: string[]
) => {
  const ingredientsRequiringBonus = ingredients.filter(
    (p: Product) => p.IsBonusRequired
  );
  return ingredientsRequiringBonus.every((p: Product) =>
    bonusProductIds.includes(p.ID.toString())
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
    return (
      !p.MaxShelfLifeInDays ||
      Number(p.MaxShelfLifeInDays) >= dayInWeek - deliveryDayInWeek
    );
  });
};

/**
 * Check if the meal has ingredients.
 * It checks if the products required for the meal are present.
 * @param productsRequired - The list of products required for the meal.
 * @returns True if there are ingredients, false otherwise.
 */
export const hasIngredients = (productsRequired: Product[]) => {
  return productsRequired.length > 0;
};

/**
 * Check if the meal is not already in the plan.
 * It checks if the meal's slug is not present in the plan object.
 * @param meal - The meal to check.
 * @param plan - The current meal plan for the week.
 * @returns True if the meal is not in the plan, false otherwise.
 */
export const isNotInPlan = (meal: Meal, plan: Record<string, Meal | null>) => {
  const meals = Object.values(plan).filter((p) => p !== null);
  return !meals.some((m) => m?.Slug === meal.Slug);
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
export const rankMeals = (
  meals: Meal[],
  bonusProductIds: string[],
  products: Product[],
  weekPlan: WeekDay[]
) => {
  const plan: Record<string, Meal | null> = {};

  // for (const day of [weekPlan[6]]) {
  for (const day of weekPlan) {
    let matches: any[] = meals
      // 0. Filter ingredients for meals
      .map((meal) => ({
        meal,
        ingredients: products.filter((p) => p.Meal === meal.Slug),
      }))
      // Sort meals by preparation time descending
      .sort(
        (a, b) => b.meal.PreparationTimeMinutes - a.meal.PreparationTimeMinutes
      )
      // 1. Match meals that fit the criteria for the day
      .filter(({ meal, ingredients }) => {
        // Get required products for the meal
        const productsRequired = getRequiredProductsForMeal(
          day,
          meal,
          ingredients,
          { isMealLeftoverValid: isMealLeftoverValid(day, meal) }
        );
        const conditions = {
          hasIngredients: hasIngredients(ingredients),
          isNotInPlan: isNotInPlan(meal, plan),
          isPreparationTimeValid: isPreparationTimeValid(meal, day),
          isMealLeftoverValid: isMealLeftoverValid(day, meal),
          isRequiredProductDiscountsValid: isRequiredProductDiscountsValid(
            productsRequired,
            bonusProductIds
          ),
          isProductShelfLifeValid: isProductShelfLifeValid(
            productsRequired,
            day.Date
          ),
        };
        const result =
          // 1.0: Meal must have ingredients
          conditions.hasIngredients &&
          // 1.1: Is not already in the plan
          conditions.isNotInPlan &&
          // 1.1. Check if meal prep time exceeds the maximum allowed for the day
          conditions.isPreparationTimeValid &&
          // 1.2: On Sunday, must support leftovers, other days can be any meal
          conditions.isMealLeftoverValid &&
          // 1.3: If products have required discounts, check if they are currently discounted
          conditions.isRequiredProductDiscountsValid &&
          // 1.4: Check if the shelf life for the products is sufficient for this day
          conditions.isProductShelfLifeValid;

        return result;
      })
      // 2. Score the meals based on the number of bonus products required
      .map(({ meal, ingredients }) => {
        // Get required products for the meal
        const productsRequired = getRequiredProductsForMeal(
          day,
          meal,
          ingredients,
          { isMealLeftoverValid: isMealLeftoverValid(day, meal) }
        );
        // Filter products that are required and also discounted
        const productsDiscounted = productsRequired.filter((p: Product) =>
          bonusProductIds.includes(p.ID.toString())
        );
        const score = productsDiscounted.length;

        return {
          meal: {
            ...meal,
            productsRequired,
            productsDiscounted: productsDiscounted.map((p) => p.URL),
            shoppingList: createShoppingList(productsRequired),
          },
          score,
        };
      })
      // 3. Sort meals descending by the number of discounted products
      .sort((a, b) => b.score - a.score);

    // If no matches, skip to next day
    if (!matches.length) {
      plan[day.Day] = null;
      continue;
    }

    // If the top meal has discounted products, use it
    if (matches[0].score) {
      plan[day.Day] = matches[0].meal;
    } else {
      const randIndex = Math.floor(Math.random() * matches.length);
      plan[day.Day] = matches.length ? matches[randIndex].meal : null;
    }

    // console.log(day.Day, matches);
  }

  return plan;
};

/**
 * Create a shopping list URL for the AH website with the required products.
 * @param productsRequired - The list of products required for the meal.
 * @returns A URL string that can be used to add the products to the AH shopping list.
 */
const createShoppingList = (productsRequired: Product[]) => {
  const url = new URL("https://www.ah.nl/mijnlijst/add-multiple");
  productsRequired.forEach((p: Product) => {
    url.searchParams.append(`p`, `${p.ID}:${p.Quantity}`);
  });
  return url.toString();
};
