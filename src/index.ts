import Bonus from "./data/bonus.json";
import Week from "./data/week.json";
import {
  fetchBonusProducts,
  fetchSheet,
  matchMeals,
  sortWeekByPreparationTime,
} from "./validation";

const FETCH_BONUS_DATA = false;
const SPREADSHEET_ID = "1Eha0kkyNBRMkTmDETDbYHf5bYtZy5RswXsxBOCo9NW8";

const main = async () => {
  const [meals, products] = await Promise.all([
    fetchSheet(SPREADSHEET_ID, "Meals"),
    fetchSheet(SPREADSHEET_ID, "Products"),
  ]);
  const week = sortWeekByPreparationTime(Week);
  console.log("Week:", week);
  const bonusProductIds = FETCH_BONUS_DATA ? await fetchBonusProducts() : Bonus;
  const plan = matchMeals(meals, bonusProductIds, products, week);

  console.log("🛒 Shopping List");
  console.log({
    Monday: plan.Monday,
    Tuesday: plan.Tuesday,
    Wednesday: plan.Wednesday,
    Thursday: plan.Thursday,
    Friday: plan.Friday,
    Saturday: plan.Saturday,
    Sunday: plan.Sunday,
  });
};

main().catch((error) => console.error(error));
