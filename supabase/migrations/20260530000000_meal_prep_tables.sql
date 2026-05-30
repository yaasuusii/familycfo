-- ============================================================
-- Meal Prep & Pregnancy Nutrition Tables
-- ============================================================

-- Pregnancy profile (trimester tracking)
CREATE TABLE IF NOT EXISTS pregnancy_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  due_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE pregnancy_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own pregnancy profile"
  ON pregnancy_profile FOR ALL USING (auth.uid() = user_id);

-- Weekly meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL, -- always a Monday
  created_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(week_start)
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage meal plans"
  ON meal_plans FOR ALL USING (auth.uid() IS NOT NULL);

-- Individual meals within a plan
CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon, 6=Sun
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','morning_snack','lunch','afternoon_snack','dinner')),
  name text NOT NULL,
  notes text,
  is_batch boolean DEFAULT false, -- cooked in bulk, covers multiple days
  batch_days smallint DEFAULT 1 CHECK (batch_days BETWEEN 1 AND 7),
  estimated_cost numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, day_of_week, meal_type)
);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage meals"
  ON meals FOR ALL USING (auth.uid() IS NOT NULL);

-- Nutrition tags per meal (iron, folate, calcium, protein, fiber, vitamin_a, vitamin_c, omega3)
CREATE TABLE IF NOT EXISTS meal_nutrition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  nutrient text NOT NULL CHECK (nutrient IN ('iron','folate','calcium','protein','fiber','vitamin_a','vitamin_c','omega3')),
  UNIQUE(meal_id, nutrient)
);

ALTER TABLE meal_nutrition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage meal nutrition"
  ON meal_nutrition FOR ALL USING (auth.uid() IS NOT NULL);

-- Pregnancy food safety warnings
CREATE TABLE IF NOT EXISTS food_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  warning text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('avoid','limit','caution'))
);

ALTER TABLE food_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read food warnings"
  ON food_warnings FOR SELECT USING (true);

-- Seed common pregnancy food warnings
INSERT INTO food_warnings (keyword, warning, severity) VALUES
  ('kitfo', 'Raw meat — risk of bacteria. Cook thoroughly during pregnancy.', 'avoid'),
  ('raw', 'Raw or undercooked food may contain harmful bacteria.', 'avoid'),
  ('sushi', 'Raw fish may contain parasites or mercury.', 'avoid'),
  ('caffeine', 'Limit to 200mg/day (about 1 cup of coffee).', 'limit'),
  ('coffee', 'Limit caffeine to 200mg/day during pregnancy.', 'limit'),
  ('tuna', 'High mercury — limit to 2 servings per week.', 'limit'),
  ('soft cheese', 'Unpasteurized soft cheese may contain listeria.', 'avoid'),
  ('alcohol', 'No safe amount of alcohol during pregnancy.', 'avoid'),
  ('energy drink', 'High caffeine and additives — avoid during pregnancy.', 'avoid'),
  ('raw egg', 'Risk of salmonella — cook eggs fully.', 'avoid'),
  ('deli meat', 'Risk of listeria — heat to steaming before eating.', 'caution'),
  ('liver', 'Very high in vitamin A — limit intake.', 'limit')
ON CONFLICT (keyword) DO NOTHING;

-- Daily water intake tracking
CREATE TABLE IF NOT EXISTS water_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  glasses smallint NOT NULL DEFAULT 0 CHECK (glasses >= 0 AND glasses <= 20),
  goal smallint NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE water_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own water intake"
  ON water_intake FOR ALL USING (auth.uid() = user_id);

-- Cravings log
CREATE TABLE IF NOT EXISTS cravings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  item text NOT NULL,
  satisfied boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cravings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own cravings"
  ON cravings FOR ALL USING (auth.uid() = user_id);
