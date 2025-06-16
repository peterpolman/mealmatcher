import Meals from "./data/meals.json";
import Week from "./data/week.json";
import { isMealLeftoverValid, isPreparationTimeValid } from "./validation";

describe("Validation", () => {
  it("isPrepatationTimeValid", async () => {
    // 15min on monday is valid
    expect(isPreparationTimeValid(Meals[0], Week[0])).toBe(true);
    // 60min on monday is valid
    expect(isPreparationTimeValid(Meals[5], Week[0])).toBe(true);
    // 60min on monday is valid
    expect(isPreparationTimeValid(Meals[5], Week[1])).toBe(true);
    // 60min on tuesday is invalid
    expect(isPreparationTimeValid(Meals[5], Week[2])).toBe(false);
  });

  it("isMealLeftoverValid", async () => {
    expect(isMealLeftoverValid(Week[0], Meals[0])).toBe(true);
  });

  it("isRequiredProductDiscountsValid", async () => {
    // expect(isRequiredProductDiscountsValid()).toBe(true);
  });
});
