-- Ingredients per meal for grocery list generation
CREATE TABLE IF NOT EXISTS meal_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(10,2),
  unit text, -- kg, g, pcs, cup, tbsp, etc.
  estimated_cost numeric(10,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meal_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage meal ingredients"
  ON meal_ingredients FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_meal_ingredients_meal_id ON meal_ingredients(meal_id);
