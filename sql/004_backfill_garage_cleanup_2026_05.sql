/*
  Backfill: 13 items sold in May 2026 from the garage cleanup.

  Run once as the server admin in sqldb-resale-prep -> Query editor.
  Safe to run again: the group is created only if missing, and an item is
  skipped if the same title is already in that group for that month.

  Backfilled sales: status 'sold', is_backfill = 1, sold on the 1st of the
  month, and no listing date, condition, photo or asking price.
*/
SET XACT_ABORT ON;  -- any error rolls back everything below
BEGIN TRANSACTION;

DECLARE @group_name NVARCHAR(100) = N'Garage Cleanup';
DECLARE @sold_month DATE = '2026-05-01';

-- The group (created if it doesn't exist yet)
IF NOT EXISTS (SELECT 1 FROM dbo.groups WHERE name = @group_name)
    INSERT dbo.groups (id, name) VALUES (NEWID(), @group_name);
DECLARE @group_id UNIQUEIDENTIFIER = (SELECT id FROM dbo.groups WHERE name = @group_name);

-- Market, currency and listing language: the current market (Sweden, SEK, sv)
DECLARE @market VARCHAR(10), @currency CHAR(3), @lang VARCHAR(10);
SELECT @market = code, @currency = currency_code, @lang = listing_language
FROM dbo.markets WHERE is_current = 1;

INSERT dbo.items (id, market_code, currency_code, listing_language, title,
                  group_id, price_sold, status, date_sold, is_backfill)
SELECT NEWID(), @market, @currency, @lang, s.title,
       @group_id, s.price, 'sold', @sold_month, 1
FROM (VALUES
    (N'Euro coins',            460),
    (N'Koppar',                750),
    (N'Skorstentändare',       100),
    (N'Radiatorer',            600),
    (N'Varmvattenberedaren',   600),
    (N'Klinker',               600),
    (N'Klinker2',              900),
    (N'Spabad lock',           600),
    (N'Spabad kemikalier',     300),
    (N'Fåtölj',                250),
    (N'Ikea tavla',            100),
    (N'Espegard soppgryta',    360),
    (N'Ozone maskin',          400)
) AS s (title, price)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.items AS i
    WHERE i.title = s.title AND i.group_id = @group_id AND i.date_sold = @sold_month
);

COMMIT;

-- Check: expect 13 items and 6 020 kr.
SELECT title, price_sold FROM dbo.items WHERE group_id = @group_id ORDER BY price_sold DESC, title;
SELECT COUNT(*) AS items, SUM(price_sold) AS total_kr FROM dbo.items WHERE group_id = @group_id;
