USE [NationalParkDB]
GO

/****** Object:  Trigger [dbo].[trg_deny_auth_achievement_permission]    Script Date: 2025/12/31 14:52:13 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

-- 触发器：保密成果授权后，禁止修改共享权限（SQL Server 版本）
CREATE TRIGGER [dbo].[trg_deny_auth_achievement_permission]
ON [dbo].[ResearchAchievements]
INSTEAD OF UPDATE  -- SQL Server 用 INSTEAD OF 拦截非法更新
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 仅当共享权限被修改，且成果为保密且已授权时触发拦截
    IF UPDATE(share_permission)
    BEGIN
        -- 检查是否有已授权的保密成果被修改权限
        IF EXISTS (
            SELECT 1 
            FROM inserted i  -- 新数据
            JOIN deleted d ON i.achievement_id = d.achievement_id  -- 旧数据
            JOIN AuthorizedAccesses auth ON i.achievement_id = auth.achievement_id
            WHERE d.share_permission = '保密' AND i.share_permission != '保密'
        )
        BEGIN
            -- 抛出错误，终止更新操作
            RAISERROR ('该保密成果已授权用户访问，禁止修改共享权限', 16, 1);
            RETURN;
        END
    END
    
    -- 若校验通过，执行正常更新（INSTEAD OF 需手动重写更新逻辑）
    UPDATE ResearchAchievements
    SET 
        project_id = i.project_id,
        achievement_type = i.achievement_type,
        title = i.title,
        publish_date = i.publish_date,
        share_permission = i.share_permission,
        file_path = i.file_path
    FROM inserted i
    WHERE ResearchAchievements.achievement_id = i.achievement_id;
END;
GO

ALTER TABLE [dbo].[ResearchAchievements] ENABLE TRIGGER [trg_deny_auth_achievement_permission]
GO


