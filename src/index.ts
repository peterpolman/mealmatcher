import Meals from "./data/meals.json";
import Products from "./data/products.json";
import Week from "./data/week.json";
import { fetchBonusProducts, matchMeals } from "./validation";

const main = async () => {
  const bonusProductIds = await fetchBonusProducts();
  const plan = matchMeals(Meals, bonusProductIds, Products, Week);
  console.log(plan);

  // TODO
  // - Insert complete product data set
  // - Expand tests to validate proper algo functionality
  // - Add required products for meal to shopping cart (correct quantities)
};

main().catch((error) => console.error(error));
