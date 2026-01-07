USE NationalParkDB;
GO

CREATE OR ALTER PROCEDURE dbo.sp_batch_authorize_achievement
    @achievement_id VARCHAR(50),
    @user_ids VARCHAR(1000),
    @authorizer_id VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ResearchAchievements WHERE achievement_id = @achievement_id)
    BEGIN
        RAISERROR (N'成果不存在，授权失败', 16, 1);
        RETURN;
    END

    IF (SELECT share_permission FROM dbo.ResearchAchievements WHERE achievement_id = @achievement_id) != N'保密'
    BEGIN
        RAISERROR (N'仅保密成果需要授权', 16, 1);
        RETURN;
    END

    DECLARE @user_id VARCHAR(50), @pos INT;
    SET @user_ids = @user_ids + ',';

    WHILE CHARINDEX(',', @user_ids) > 0
    BEGIN
        SET @pos = CHARINDEX(',', @user_ids);
        SET @user_id = LEFT(@user_ids, @pos - 1);

        IF @user_id IS NOT NULL AND LTRIM(RTRIM(@user_id)) <> ''
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM dbo.AuthorizedAccesses
                WHERE achievement_id = @achievement_id AND user_id = @user_id
            )
            BEGIN
                INSERT INTO dbo.AuthorizedAccesses (achievement_id, user_id, authorize_time)
                VALUES (@achievement_id, @user_id, GETDATE());
            END
        END

        SET @user_ids = STUFF(@user_ids, 1, @pos, '');
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_revoke_achievement_auth
    @achievement_id VARCHAR(50),
    @user_id VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.AuthorizedAccesses
        WHERE achievement_id = @achievement_id AND user_id = @user_id
    )
    BEGIN
        RAISERROR (N'用户未被授权访问此成果，无法撤销', 16, 1);
        RETURN;
    END

    DELETE FROM dbo.AuthorizedAccesses
    WHERE achievement_id = @achievement_id AND user_id = @user_id;
END;
GO

IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_cascade_delete_auth' AND parent_id = OBJECT_ID(N'dbo.ResearchAchievements'))
DROP TRIGGER dbo.trg_cascade_delete_auth;
GO

CREATE TRIGGER dbo.trg_cascade_delete_auth
ON dbo.ResearchAchievements
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.AuthorizedAccesses
    WHERE achievement_id IN (SELECT achievement_id FROM deleted);
END;
GO

IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_deny_auth_achievement_permission' AND parent_id = OBJECT_ID(N'dbo.ResearchAchievements'))
DROP TRIGGER dbo.trg_deny_auth_achievement_permission;
GO

CREATE TRIGGER dbo.trg_deny_auth_achievement_permission
ON dbo.ResearchAchievements
INSTEAD OF UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(share_permission)
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM inserted i
            JOIN deleted d ON i.achievement_id = d.achievement_id
            JOIN dbo.AuthorizedAccesses auth ON i.achievement_id = auth.achievement_id
            WHERE d.share_permission = N'保密' AND i.share_permission <> N'保密'
        )
        BEGIN
            RAISERROR (N'该保密成果已授权用户访问，禁止修改共享权限', 16, 1);
            RETURN;
        END
    END

    UPDATE dbo.ResearchAchievements
    SET
        project_id = i.project_id,
        achievement_type = i.achievement_type,
        title = i.title,
        publish_date = i.publish_date,
        share_permission = i.share_permission,
        file_path = i.file_path
    FROM inserted i
    WHERE dbo.ResearchAchievements.achievement_id = i.achievement_id;
END;
GO
