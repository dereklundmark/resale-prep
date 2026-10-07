/*
  Resale Prep: database schema (Azure SQL Database, sqldb-resale-prep).

  Run once, as the server admin (resaleadmin), in the Azure portal:
  sqldb-resale-prep -> Query editor -> paste this file -> Run.
  Safe to run again: each table is only created if it doesn't exist yet.

  Mirrors src/lib/types.ts (Item, Group, Photo). Totals and "days listed"
  are never stored; the app derives them from these rows.
*/

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
IF OBJECT_ID(N'dbo.items', N'U') IS NULL
CREATE TABLE dbo.items (
    id                     UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_items PRIMARY KEY,
    title                  NVARCHAR(200)    NOT NULL,
    description            NVARCHAR(4000)   NOT NULL CONSTRAINT df_items_description DEFAULT N'',
    condition              NVARCHAR(30)     NULL,      -- NULL for backfilled sales
    group_id               UNIQUEIDENTIFIER NULL
        CONSTRAINT fk_items_group REFERENCES dbo.groups (id) ON DELETE SET NULL,

    -- Which platforms it's listed on, and the category chosen for each.
    listed_tradera         BIT              NOT NULL CONSTRAINT df_items_lt DEFAULT 0,
    listed_blocket         BIT              NOT NULL CONSTRAINT df_items_lb DEFAULT 0,
    listed_facebook        BIT              NOT NULL CONSTRAINT df_items_lf DEFAULT 0,
    category_tradera       NVARCHAR(200)    NULL,
    category_blocket       NVARCHAR(200)    NULL,
    category_facebook      NVARCHAR(200)    NULL,

    -- Whole kronor.
    price_listed           INT              NULL,      -- NULL for backfilled sales
    price_sold             INT              NULL,      -- NULL until sold

    status                 VARCHAR(10)      NOT NULL,  -- 'active' or 'sold'
    date_listed            DATE             NULL,      -- NULL for backfilled sales
    date_sold              DATE             NULL,      -- backfills: 1st of the month entered
    is_backfill            BIT              NOT NULL CONSTRAINT df_items_backfill DEFAULT 0,

    -- What Gemini suggested when the listing was made (kept for later analysis).
    ai_estimate_low        INT              NULL,
    ai_estimate_high       INT              NULL,
    ai_estimate_reasoning  NVARCHAR(1000)   NULL,

    notes                  NVARCHAR(2000)   NULL,
    created_at             DATETIME2(3)     NOT NULL CONSTRAINT df_items_created DEFAULT SYSUTCDATETIME(),
    updated_at             DATETIME2(3)     NOT NULL CONSTRAINT df_items_updated DEFAULT SYSUTCDATETIME(),

    -- Rules the database enforces, whatever the app sends:
    CONSTRAINT ck_items_status CHECK (status IN ('active', 'sold')),
    CONSTRAINT ck_items_condition CHECK (condition IS NULL OR condition IN
        (N'Ny', N'Nyskick', N'Mycket bra skick', N'Bra skick', N'Använt skick', N'Renoveringsobjekt')),
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

-- Quick check: should list groups, items, photos.
SELECT name, create_date FROM sys.tables ORDER BY name;
