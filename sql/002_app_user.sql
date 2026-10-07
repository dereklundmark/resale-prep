/*
  Resale Prep: the login the app's API uses (least privilege).

  Run once, as the server admin, in sqldb-resale-prep -> Query editor
  (in the DATABASE, not in "master").

  1. Replace CHANGE-ME below with a new strong password (not your admin one).
     Save it in your password manager. It goes into the Static Web App's
     environment variables as SQL_PASSWORD, and nowhere else.
  2. Run. Then clear the password from the editor; never commit it.

  resale_app can read and write rows in the app's tables, but can't create,
  change or drop tables, and can't see other databases. If the password ever
  leaks:  ALTER USER resale_app WITH PASSWORD = '<new one>';
*/

CREATE USER resale_app WITH PASSWORD = 'CHANGE-ME';
GO

ALTER ROLE db_datareader ADD MEMBER resale_app;
ALTER ROLE db_datawriter ADD MEMBER resale_app;
GO

-- Quick check: should show resale_app in db_datareader and db_datawriter.
SELECT r.name AS role_name, m.name AS member_name
FROM sys.database_role_members AS drm
JOIN sys.database_principals AS r ON r.principal_id = drm.role_principal_id
JOIN sys.database_principals AS m ON m.principal_id = drm.member_principal_id
WHERE m.name = N'resale_app';
