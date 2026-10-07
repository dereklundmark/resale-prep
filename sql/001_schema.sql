/*
  Resale Prep: database schema (Azure SQL Database, sqldb-resale-prep).

  Run once, as the server admin (resaleadmin), in the Azure portal:
  sqldb-resale-prep -> Query editor -> paste this file -> Run.
  Then run 003_seed.sql for the starting data (Sweden, the three platforms,
  the conditions). Safe to run again: tables are only created if missing.

  Built to grow without schema changes:
  - New marketplace (Vinted, eBay...)  -> a row in dbo.platforms
  - New country / language / currency  -> a row in dbo.markets (+ its platforms)
  - New language for condition names   -> rows in dbo.condition_labels
  Totals and "days listed" are never stored; the app derives them.
*/

-- A country the seller lists in: the language listings are written in, the
-- currency, and how numbers and dates are formatted. One is "current"; new
-- items are created in it.
IF OBJECT_ID(N'dbo.markets', N'U') IS NULL
CREATE TABLE dbo.markets (
    code              VARCHAR(10)   NOT NULL CONSTRAINT pk_markets PRIMARY KEY,  -- 'SE'
    name              NVARCHAR(100) NOT NULL,                                    -- 'Sweden'
    listing_language  VARCHAR(10)   NOT NULL,  -- BCP 47 language for titles/descriptions, 'sv'
    currency_code     CHAR(3)       NOT NULL,  -- ISO 4217, 'SEK'
    locale            VARCHAR(20)   NOT NULL,  -- number/date formatting, 'sv-SE'
    is_current        BIT           NOT NULL CONSTRAINT df_markets_current DEFAULT 0
);
GO
-- At most one current market.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_markets_one_current')
CREATE UNIQUE INDEX uq_markets_one_current ON dbo.markets (is_current) WHERE is_current = 1;
GO

-- Marketplaces such as Tradera, Blocket, Facebook Marketplace. Turn one off
-- with is_enabled = 0; past listings on it are kept.
IF OBJECT_ID(N'dbo.platforms', N'U') IS NULL
CREATE TABLE dbo.platforms (
    code           VARCHAR(30)   NOT NULL CONSTRAINT pk_platforms PRIMARY KEY,  -- 'tradera'
    market_code    VARCHAR(10)   NOT NULL CONSTRAINT fk_platforms_market REFERENCES dbo.markets (code),
    name           NVARCHAR(100) NOT NULL,   -- 'Tradera'
    -- Tells Gemini how this site names its categories.
    category_hint  NVARCHAR(400) NOT NULL,
    -- Colours from the design: stripe/bar, pill background, text on the pill.
    color_strong   VARCHAR(40)   NOT NULL,
    color_tint     VARCHAR(40)   NOT NULL,
    color_text     VARCHAR(40)   NOT NULL,
    sort_order     TINYINT       NOT NULL CONSTRAINT df_platforms_sort DEFAULT 0,
    is_enabled     BIT           NOT NULL CONSTRAINT df_platforms_enabled DEFAULT 1
);
GO

-- Item conditions as neutral codes ('very_good'), with a label per language.
IF OBJECT_ID(N'dbo.conditions', N'U') IS NULL
CREATE TABLE dbo.conditions (
    code        VARCHAR(30) NOT NULL CONSTRAINT pk_conditions PRIMARY KEY,
    sort_order  TINYINT     NOT NULL
);
GO
IF OBJECT_ID(N'dbo.condition_labels', N'U') IS NULL
CREATE TABLE dbo.condition_labels (
    condition_code  VARCHAR(30)  NOT NULL CONSTRAINT fk_condition_labels_condition REFERENCES dbo.conditions (code),
    language        VARCHAR(10)  NOT NULL,   -- 'sv', 'en'
    label           NVARCHAR(50) NOT NULL,   -- 'Mycket bra skick', 'Very good'
    CONSTRAINT pk_condition_labels PRIMARY KEY (condition_code, language)
);
GO

-- Groups such as "Garage Cleanout" or "Old Baby Room".
IF OBJECT_ID(N'dbo.groups', N'U') IS NULL
CREATE TABLE dbo.groups (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_groups PRIMARY KEY,
    name          NVARCHAR(100)    NOT NULL CONSTRAINT uq_groups_name UNIQUE,
    description   NVARCHAR(500)    NULL,
    created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_groups_created DEFAULT SYSUTCDATETIME()
);
GO

-- One row per item, for sale or sold (including backfilled past sales).
-- Each item keeps the market, currency and language it was made in, so old
-- Swedish sales stay correct after a move abroad.
IF OBJECT_ID(N'dbo.items', N'U') IS NULL
CREATE TABLE dbo.items (
    id                     UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_items PRIMARY KEY,
    market_code            VARCHAR(10)      NOT NULL CONSTRAINT fk_items_market REFERENCES dbo.markets (code),
    currency_code          CHAR(3)          NOT NULL,   -- currency of the prices below
    listing_language       VARCHAR(10)      NOT NULL,   -- language of title/description
    title                  NVARCHAR(200)    NOT NULL,
    description            NVARCHAR(4000)   NOT NULL CONSTRAINT df_items_description DEFAULT N'',
    condition_code         VARCHAR(30)      NULL        -- NULL for backfilled sales
        CONSTRAINT fk_items_condition REFERENCES dbo.conditions (code),
    group_id               UNIQUEIDENTIFIER NULL
        CONSTRAINT fk_items_group REFERENCES dbo.groups (id) ON DELETE SET NULL,

    -- In currency_code. DECIMAL so currencies with cents (EUR, USD) work too.
    price_listed           DECIMAL(12, 2)   NULL,       -- NULL for backfilled sales
    price_sold             DECIMAL(12, 2)   NULL,       -- NULL until sold

    status                 VARCHAR(10)      NOT NULL,   -- 'active' or 'sold'
    date_listed            DATE             NULL,       -- NULL for backfilled sales
    date_sold              DATE             NULL,       -- backfills: 1st of the month entered
    is_backfill            BIT              NOT NULL CONSTRAINT df_items_backfill DEFAULT 0,

    -- What Gemini suggested when the listing was made (kept for later analysis).
    ai_estimate_low        DECIMAL(12, 2)   NULL,
    ai_estimate_high       DECIMAL(12, 2)   NULL,
    ai_estimate_reasoning  NVARCHAR(1000)   NULL,

    notes                  NVARCHAR(2000)   NULL,
    created_at             DATETIME2(3)     NOT NULL CONSTRAINT df_items_created DEFAULT SYSUTCDATETIME(),
    updated_at             DATETIME2(3)     NOT NULL CONSTRAINT df_items_updated DEFAULT SYSUTCDATETIME(),

    -- Rules the database enforces, whatever the app sends:
    CONSTRAINT ck_items_status CHECK (status IN ('active', 'sold')),
    -- A sold item has a sale price and date; an active one has neither.
    CONSTRAINT ck_items_sold_fields CHECK (
        (status = 'active' AND price_sold IS NULL AND date_sold IS NULL) OR
        (status = 'sold' AND price_sold IS NOT NULL AND date_sold IS NOT NULL)),
    -- Backfilled sales are always sold and were never "listed" in the app.
    CONSTRAINT ck_items_backfill CHECK (is_backfill = 0 OR (status = 'sold' AND date_listed IS NULL)),
    CONSTRAINT ck_items_prices CHECK ((price_listed IS NULL OR price_listed >= 0) AND (price_sold IS NULL OR price_sold >= 0)),
    CONSTRAINT ck_items_estimate CHECK (ai_estimate_low IS NULL OR ai_estimate_high IS NULL OR ai_estimate_low <= ai_estimate_high)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_items_status_group')
CREATE INDEX ix_items_status_group ON dbo.items (status, group_id);
GO

-- Which platforms an item is listed on, and its category on each.
-- One row per item + platform, so any number of platforms works.
IF OBJECT_ID(N'dbo.item_platforms', N'U') IS NULL
CREATE TABLE dbo.item_platforms (
    item_id        UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT fk_item_platforms_item REFERENCES dbo.items (id) ON DELETE CASCADE,
    platform_code  VARCHAR(30)      NOT NULL
        CONSTRAINT fk_item_platforms_platform REFERENCES dbo.platforms (code),
    category       NVARCHAR(200)    NULL,
    CONSTRAINT pk_item_platforms PRIMARY KEY (item_id, platform_code)
);
GO

-- Photos, stored in the database (Blob Storage is only free for 12 months).
-- The app shrinks each photo to ~150 KB before upload. Deleting an item
-- deletes its photos.
IF OBJECT_ID(N'dbo.photos', N'U') IS NULL
CREATE TABLE dbo.photos (
    id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_photos PRIMARY KEY,
    item_id      UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT fk_photos_item REFERENCES dbo.items (id) ON DELETE CASCADE,
    position     TINYINT          NOT NULL,  -- 0 = main photo / thumbnail
    full_jpeg    VARBINARY(MAX)   NOT NULL,  -- long edge <= 1280 px
    thumb_jpeg   VARBINARY(MAX)   NOT NULL,  -- 160 x 160 px
    created_at   DATETIME2(3)     NOT NULL CONSTRAINT df_photos_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_photos_item_position UNIQUE (item_id, position)
);
GO

-- Quick check: should list the 8 tables.
SELECT name, create_date FROM sys.tables ORDER BY name;
