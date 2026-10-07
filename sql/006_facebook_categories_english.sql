/*
  Facebook Marketplace categories in English (the app is used in English),
  while Tradera and Blocket stay Swedish.

  Data only: Gemini reads each platform's category_hint when it suggests
  categories, so no code change or deploy is needed. Takes effect within
  about 5 minutes (the API caches the platform list briefly).

  Run as the server admin in sqldb-resale-prep -> Query editor.
*/
UPDATE dbo.platforms
SET category_hint = N'Facebook Marketplace (category path in ENGLISH, exactly as shown in the English-language Marketplace app, e.g. "Home & Garden › Furniture")'
WHERE code = 'facebook';

SELECT code, name, category_hint FROM dbo.platforms ORDER BY sort_order;
