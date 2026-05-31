-- Market prices for grocery items (updated from vendor price lists)
CREATE TABLE IF NOT EXISTS market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_amharic text,
  price numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  category text,
  source text DEFAULT 'manual',
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(name)
);

ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage market prices"
  ON market_prices FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_market_prices_name ON market_prices(name);
CREATE INDEX idx_market_prices_category ON market_prices(category);
