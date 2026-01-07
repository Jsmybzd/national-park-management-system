USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.[ResearchProjects]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ResearchProjects](
        [project_id] VARCHAR(50) NOT NULL PRIMARY KEY,
        [project_name] NVARCHAR(200) NOT NULL,
        [leader_id] VARCHAR(50) NOT NULL,
        [apply_unit] NVARCHAR(100) NOT NULL,
        [approval_date] DATE NOT NULL,
        [conclusion_date] DATE NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ResearchProjects_status] DEFAULT (N'在研'),
        [research_field] NVARCHAR(50) NOT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.[ResearchProjects]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.ResearchProjects', N'project_id') IS NULL
    BEGIN
        RAISERROR(N'dbo.ResearchProjects 已存在但缺少 project_id 列，说明库里已有同名但不同结构的表。请先备份并重命名/删除该表，再执行 research_tables.sql。', 16, 1);
        RETURN;
    END

    IF COL_LENGTH(N'dbo.ResearchProjects', N'project_name') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD project_name NVARCHAR(200) NOT NULL CONSTRAINT [DF_ResearchProjects_project_name] DEFAULT (N'') WITH VALUES;
    IF COL_LENGTH(N'dbo.ResearchProjects', N'leader_id') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD leader_id VARCHAR(50) NOT NULL CONSTRAINT [DF_ResearchProjects_leader_id] DEFAULT ('') WITH VALUES;
    IF COL_LENGTH(N'dbo.ResearchProjects', N'apply_unit') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD apply_unit NVARCHAR(100) NOT NULL CONSTRAINT [DF_ResearchProjects_apply_unit] DEFAULT (N'') WITH VALUES;
    IF COL_LENGTH(N'dbo.ResearchProjects', N'approval_date') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD approval_date DATE NOT NULL CONSTRAINT [DF_ResearchProjects_approval_date] DEFAULT (CONVERT(date, GETDATE())) WITH VALUES;
    IF COL_LENGTH(N'dbo.ResearchProjects', N'conclusion_date') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD conclusion_date DATE NULL;
    IF COL_LENGTH(N'dbo.ResearchProjects', N'status') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD status NVARCHAR(20) NOT NULL CONSTRAINT [DF_ResearchProjects_status2] DEFAULT (N'在研') WITH VALUES;
    IF COL_LENGTH(N'dbo.ResearchProjects', N'research_field') IS NULL
        ALTER TABLE dbo.ResearchProjects ADD research_field NVARCHAR(50) NOT NULL CONSTRAINT [DF_ResearchProjects_research_field] DEFAULT (N'') WITH VALUES;
END
GO

IF COL_LENGTH(N'dbo.ResearchProjects', N'status') IS NOT NULL
   AND COL_LENGTH(N'dbo.ResearchProjects', N'research_field') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'idx_researchproject_status_field'
          AND object_id = OBJECT_ID(N'dbo.[ResearchProjects]')
   )
BEGIN
    CREATE NONCLUSTERED INDEX [idx_researchproject_status_field]
    ON dbo.[ResearchProjects]([status] ASC, [research_field] ASC)
    INCLUDE([project_name],[leader_id],[apply_unit],[approval_date],[conclusion_date]);
END
GO

IF OBJECT_ID(N'dbo.[DataCollections]', N'U') IS NULL
BEGIN
    IF COL_LENGTH(N'dbo.ResearchProjects', N'project_id') IS NULL
    BEGIN
        RAISERROR(N'缺少 dbo.ResearchProjects(project_id)，无法创建 DataCollections 外键。', 16, 1);
        RETURN;
    END
    CREATE TABLE dbo.[DataCollections](
        [collection_id] VARCHAR(50) NOT NULL PRIMARY KEY,
        [project_id] VARCHAR(50) NOT NULL,
        [collector_id] VARCHAR(50) NOT NULL,
        [collection_time] DATETIME NOT NULL,
        [area_id] VARCHAR(50) NOT NULL,
        [content] NTEXT NOT NULL,
        [data_source] NVARCHAR(20) NOT NULL,
        [remarks] NTEXT NULL,
        CONSTRAINT [FK_DataCollections_ResearchProjects] FOREIGN KEY([project_id]) REFERENCES dbo.[ResearchProjects]([project_id])
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_datacollection_area_id'
      AND object_id = OBJECT_ID(N'dbo.[DataCollections]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_datacollection_area_id]
    ON dbo.[DataCollections]([area_id] ASC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_datacollection_project_time'
      AND object_id = OBJECT_ID(N'dbo.[DataCollections]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_datacollection_project_time]
    ON dbo.[DataCollections]([project_id] ASC, [collection_time] DESC)
    INCLUDE([collector_id],[area_id],[data_source]);
END
GO

IF OBJECT_ID(N'dbo.[ResearchAchievements]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[ResearchAchievements](
        [achievement_id] VARCHAR(50) NOT NULL PRIMARY KEY,
        [project_id] VARCHAR(50) NOT NULL,
        [achievement_type] NVARCHAR(20) NOT NULL,
        [title] NVARCHAR(200) NOT NULL,
        [publish_date] DATE NOT NULL,
        [share_permission] NVARCHAR(20) NOT NULL,
        [file_path] VARCHAR(255) NOT NULL,
        CONSTRAINT [FK_ResearchAchievements_ResearchProjects] FOREIGN KEY([project_id]) REFERENCES dbo.[ResearchProjects]([project_id])
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_researchachievement_project_permission'
      AND object_id = OBJECT_ID(N'dbo.[ResearchAchievements]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_researchachievement_project_permission]
    ON dbo.[ResearchAchievements]([project_id] ASC, [share_permission] ASC)
    INCLUDE([title],[achievement_type],[publish_date]);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_researchachievement_publish_date'
      AND object_id = OBJECT_ID(N'dbo.[ResearchAchievements]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_researchachievement_publish_date]
    ON dbo.[ResearchAchievements]([publish_date] ASC);
END
GO

IF OBJECT_ID(N'dbo.[AuthorizedAccesses]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[AuthorizedAccesses](
        [access_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [achievement_id] VARCHAR(50) NOT NULL,
        [user_id] VARCHAR(50) NOT NULL,
        [authorize_time] DATETIME NOT NULL CONSTRAINT [DF_AuthorizedAccesses_authorize_time] DEFAULT (GETDATE()),
        CONSTRAINT [FK_AuthorizedAccesses_ResearchAchievements] FOREIGN KEY([achievement_id]) REFERENCES dbo.[ResearchAchievements]([achievement_id]) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.[AuthorizedAccesses]', N'U') IS NOT NULL
BEGIN
    DECLARE @fkname SYSNAME;

    -- Drop any existing FK (any name) from AuthorizedAccesses(achievement_id)
    -- to ResearchAchievements(achievement_id) that is NOT ON DELETE CASCADE.
    WHILE 1 = 1
    BEGIN
        SELECT TOP (1) @fkname = fk.name
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc
            ON fk.object_id = fkc.constraint_object_id
        WHERE fk.parent_object_id = OBJECT_ID(N'dbo.[AuthorizedAccesses]')
          AND fk.referenced_object_id = OBJECT_ID(N'dbo.[ResearchAchievements]')
          AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = N'achievement_id'
          AND COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) = N'achievement_id'
          AND fk.delete_referential_action <> 1;

        IF @fkname IS NULL
            BREAK;

        EXEC(N'ALTER TABLE dbo.[AuthorizedAccesses] DROP CONSTRAINT [' + @fkname + N']');
        SET @fkname = NULL;
    END

    -- Create the cascade FK only if an equivalent cascade FK does not already exist.
    IF NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc
            ON fk.object_id = fkc.constraint_object_id
        WHERE fk.parent_object_id = OBJECT_ID(N'dbo.[AuthorizedAccesses]')
          AND fk.referenced_object_id = OBJECT_ID(N'dbo.[ResearchAchievements]')
          AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = N'achievement_id'
          AND COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) = N'achievement_id'
          AND fk.delete_referential_action = 1
    )
    BEGIN
        ALTER TABLE dbo.[AuthorizedAccesses]
        WITH CHECK ADD CONSTRAINT [FK_AuthorizedAccesses_ResearchAchievements]
        FOREIGN KEY([achievement_id])
        REFERENCES dbo.[ResearchAchievements]([achievement_id])
        ON DELETE CASCADE;

        ALTER TABLE dbo.[AuthorizedAccesses] CHECK CONSTRAINT [FK_AuthorizedAccesses_ResearchAchievements];
    END
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_authorizedaccess_achievement_user'
      AND object_id = OBJECT_ID(N'dbo.[AuthorizedAccesses]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_authorizedaccess_achievement_user]
    ON dbo.[AuthorizedAccesses]([achievement_id] ASC, [user_id] ASC)
    INCLUDE([authorize_time]);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_authorizedaccess_user_id'
      AND object_id = OBJECT_ID(N'dbo.[AuthorizedAccesses]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_authorizedaccess_user_id]
    ON dbo.[AuthorizedAccesses]([user_id] ASC);
END
GO
