export type Meal = {
  Slug: string;
  Meal: string;
  PreparationTimeMinutes: number;
  CanBeLeftovers: boolean;
  NumberOfPeople: number;
};

export type Product = {
  Meal: string;
  Quantity: number;
  MaxShelfLifeInDays: number | string;
  IsBonusRequired: boolean;
  ID: number;
  URL: string;
};

export type WeekDay = {
  Day: string;
  Date: string;
  NumberOfPeople: number;
  NumberOfPeopleLeftovers: number;
  MaxPreparationTime: number;
};
