# @hiddenlayers/mealmatcher

## Overview

`mealmatcher` picks meals for each day of the week by applying a set of validation rules:

1. **Preparation Time**  
   A meal’s `PreparationTimeMinutes` must not exceed the day’s `MaxPreparationTime`.

2. **Leftovers**

   - On **Sunday**, only meals with `CanBeLeftovers = true` are allowed if `NumberOfPeopleLeftovers > 0`.
   - On other days, any meal is allowed (leftovers constraint does not apply).

3. **Bonus Product Discounts**  
   If a meal has products with `IsBonusRequired = true`, all of those product IDs must appear in the fetched bonus list.

4. **Product Shelf Life**  
   Ensures each required product’s `MaxShelfLifeInDays` is sufficient for the delivery date.

## Data Files

- [`src/data/meals.json`](src/data/meals.json) — List of available meals (`Meal` type).
- [`src/data/products.json`](src/data/products.json) — Products required per meal (`Product` type).
- [`src/data/week.json`](src/data/week.json) — Week plan with daily constraints (`WeekDay` type).

## Installation

```sh
npm install
```

## Running Tests

```sh
npm test
```

## Building

```sh
npm run build
```

Compiled files will be output to `lib/` (per `tsconfig.json`).

## Usage

```sh
node lib/index.js
```

This will:

1. Launch Puppeteer and fetch current bonus product IDs.
2. Match meals for each day of the week based on the validation rules.
3. Print the resulting weekly meal plan to the console.
