/*
  Resale Prep: starting data. Run after 001_schema.sql, as the server admin.
  Safe to run again: rows are only added if they don't exist yet.

  To grow later, add rows like these, no code change needed:

    -- A new marketplace in Sweden:
    INSERT dbo.platforms (code, market_code, name, category_hint, color_strong, color_tint, color_text, sort_order)
    VALUES ('vinted', 'SE', N'Vinted', N'Vinted (category path as shown on vinted.se)',
            'oklch(0.6 0.12 190)', 'oklch(0.93 0.03 190)', 'oklch(0.42 0.09 190)', 4);

    -- Moving to another country: add the market and its platforms, then switch:
    -- UPDATE dbo.markets SET is_current = 0;  UPDATE dbo.markets SET is_current = 1 WHERE code = 'DE';
*/

-- Markets
IF NOT EXISTS (SELECT 1 FROM dbo.markets WHERE code = 'SE')
INSERT dbo.markets (code, name, listing_language, currency_code, locale, is_current)
VALUES ('SE', N'Sweden', 'sv', 'SEK', 'sv-SE', 1);

-- Platforms (colours are the design tokens: strong / tint / text)
IF NOT EXISTS (SELECT 1 FROM dbo.platforms WHERE code = 'tradera')
INSERT dbo.platforms (code, market_code, name, category_hint, color_strong, color_tint, color_text, sort_order)
VALUES ('tradera', 'SE', N'Tradera', N'Tradera (Swedish category path, e.g. "Hem & Hushåll › Möbler › Fåtöljer")',
        'oklch(0.8 0.15 85)', 'oklch(0.93 0.05 85)', 'oklch(0.42 0.09 75)', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.platforms WHERE code = 'blocket')
INSERT dbo.platforms (code, market_code, name, category_hint, color_strong, color_tint, color_text, sort_order)
VALUES ('blocket', 'SE', N'Blocket', N'Blocket (Swedish category path, e.g. "För hemmet › Möbler & heminredning")',
        'oklch(0.6 0.19 27)', 'oklch(0.93 0.035 27)', 'oklch(0.47 0.14 27)', 2);

IF NOT EXISTS (SELECT 1 FROM dbo.platforms WHERE code = 'facebook')
INSERT dbo.platforms (code, market_code, name, category_hint, color_strong, color_tint, color_text, sort_order)
VALUES ('facebook', 'SE', N'Facebook', N'Facebook Marketplace (category path as shown to users in Sweden)',
        'oklch(0.55 0.16 258)', 'oklch(0.93 0.03 258)', 'oklch(0.44 0.13 258)', 3);

-- Conditions, best to worst, with Swedish and English labels
MERGE dbo.conditions AS t
USING (VALUES ('new', 1), ('like_new', 2), ('very_good', 3), ('good', 4), ('used', 5), ('for_parts', 6))
      AS s (code, sort_order)
ON t.code = s.code
WHEN NOT MATCHED THEN INSERT (code, sort_order) VALUES (s.code, s.sort_order);

MERGE dbo.condition_labels AS t
USING (VALUES
    ('new',       'sv', N'Ny'),                ('new',       'en', N'New'),
    ('like_new',  'sv', N'Nyskick'),           ('like_new',  'en', N'Like new'),
    ('very_good', 'sv', N'Mycket bra skick'),  ('very_good', 'en', N'Very good'),
    ('good',      'sv', N'Bra skick'),         ('good',      'en', N'Good'),
    ('used',      'sv', N'Använt skick'),      ('used',      'en', N'Used'),
    ('for_parts', 'sv', N'Renoveringsobjekt'), ('for_parts', 'en', N'For repair or parts')
) AS s (condition_code, language, label)
ON t.condition_code = s.condition_code AND t.language = s.language
WHEN NOT MATCHED THEN INSERT (condition_code, language, label) VALUES (s.condition_code, s.language, s.label);
GO

-- Quick check
SELECT code, name, listing_language, currency_code, is_current FROM dbo.markets;
SELECT code, name, market_code, sort_order, is_enabled FROM dbo.platforms ORDER BY sort_order;
SELECT c.code, l.language, l.label
FROM dbo.conditions AS c JOIN dbo.condition_labels AS l ON l.condition_code = c.code
ORDER BY c.sort_order, l.language;
