/*
  Resale Prep: a "posted" tick per platform (1.3.0).

  Picking Tradera and Blocket on NEW means "I'll list it there", not that it's
  live yet. posted_on is the day the listing actually went live on that
  platform; NULL = not posted yet. ACTIVE shows it as a checklist.

  Run once as the server admin in sqldb-resale-prep -> Query editor, BEFORE
  the 1.3.0 deploy (the API reads the new column). Safe to run again.
*/

IF COL_LENGTH(N'dbo.item_platforms', N'posted_on') IS NULL
BEGIN
    ALTER TABLE dbo.item_platforms ADD posted_on DATE NULL;

    -- Everything listed before this change counts as posted on the day it was
    -- listed (untick it in the app if it isn't live yet).
    EXEC (N'UPDATE ip SET posted_on = i.date_listed
              FROM dbo.item_platforms ip JOIN dbo.items i ON i.id = ip.item_id
             WHERE i.date_listed IS NOT NULL;');
END
GO

SELECT TOP 20 i.title, ip.platform_code, ip.posted_on
  FROM dbo.item_platforms ip JOIN dbo.items i ON i.id = ip.item_id
 ORDER BY i.created_at DESC;
