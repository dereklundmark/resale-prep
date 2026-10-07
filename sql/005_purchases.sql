/*
  Resale Prep: group funds (design v3).

  A group can double as a fund: its sales earn money, purchases spend it,
  and the app shows what's left. "Left" is always calculated (earned - spent),
  never stored.

  Run once as the server admin in sqldb-resale-prep -> Query editor.
  Safe to run again. resale_app can already read/write the new table
  (db_datareader / db_datawriter cover every table).
*/

-- What the group's money is for, e.g. "Photo gear fund". NULL = no purpose.
IF COL_LENGTH(N'dbo.groups', N'purpose') IS NULL
    ALTER TABLE dbo.groups ADD purpose NVARCHAR(200) NULL;
GO

-- Things bought with a group's money. Deleting the group deletes its purchases.
IF OBJECT_ID(N'dbo.purchases', N'U') IS NULL
CREATE TABLE dbo.purchases (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_purchases PRIMARY KEY,
    group_id       UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT fk_purchases_group REFERENCES dbo.groups (id) ON DELETE CASCADE,
    title          NVARCHAR(200)    NOT NULL,   -- what was bought
    amount         DECIMAL(12, 2)   NOT NULL,   -- in currency_code
    currency_code  CHAR(3)          NOT NULL,
    purchase_date  DATE             NOT NULL,
    notes          NVARCHAR(2000)   NULL,
    created_at     DATETIME2(3)     NOT NULL CONSTRAINT df_purchases_created DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(3)     NOT NULL CONSTRAINT df_purchases_updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_purchases_amount CHECK (amount >= 0)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_purchases_group')
CREATE INDEX ix_purchases_group ON dbo.purchases (group_id);
GO

-- A view for analysis: each group's earned, spent and left. The app
-- calculates the same numbers itself; this is for querying in SQL.
CREATE OR ALTER VIEW dbo.group_funds AS
SELECT g.id AS group_id,
       g.name,
       g.purpose,
       COALESCE(s.earned, 0)                         AS earned,
       COALESCE(p.spent, 0)                          AS spent,
       COALESCE(s.earned, 0) - COALESCE(p.spent, 0)  AS left_amount
FROM dbo.groups AS g
LEFT JOIN (SELECT group_id, SUM(price_sold) AS earned
           FROM dbo.items WHERE status = 'sold' GROUP BY group_id) AS s ON s.group_id = g.id
LEFT JOIN (SELECT group_id, SUM(amount) AS spent
           FROM dbo.purchases GROUP BY group_id) AS p ON p.group_id = g.id;
GO

-- Quick check
SELECT * FROM dbo.group_funds ORDER BY name;
