import Meals from "./data/meals.json";
import Products from "./data/products.json";
import Week from "./data/week.json";
import { fetchBonusProducts, matchMeals } from "./validation";

const main = async () => {
  const bonusProductIds = await fetchBonusProducts();
  const plan = matchMeals(Meals, bonusProductIds, Products, Week);
  console.log(plan);
};

main().catch((error) => console.error(error));
