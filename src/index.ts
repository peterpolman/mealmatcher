import Bonus from "./data/bonus.json";
import Week from "./data/week.json";
import {
  fetchBonusProducts,
  fetchSheet,
  rankMeals,
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
  const plan = rankMeals(meals, bonusProductIds, products, week);

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

  // TODO
  // - [ ] Export bonus, products per meal with shopping list
  // - [ ] Ability to add .5 product quantities
  // - [ ] Auto schedule meals for the week on Saturday 5am
  // - [ ] Send export per mail and add link to rerun for a day
  // - [ ] Way to rerun a ranking for meals on a specific day
};

main().catch((error) => console.error(error));
