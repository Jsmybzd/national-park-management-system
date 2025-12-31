USE [NationalParkDB]
GO

/****** Object:  Trigger [dbo].[trg_cascade_delete_auth]    Script Date: 2025/12/31 14:51:54 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

-- 触发器：删除科研成果时，自动删除关联的授权记录（SQL Server 专用语法）
CREATE TRIGGER [dbo].[trg_cascade_delete_auth]
ON [dbo].[ResearchAchievements]
AFTER DELETE  -- SQL Server 无需 FOR EACH ROW，默认行级触发
AS
BEGIN
    SET NOCOUNT ON;  -- 关闭计数提示，避免影响返回结果
    
    -- 删除关联的授权记录（通过 deleted 虚拟表获取被删除的成果ID）
    DELETE FROM AuthorizedAccesses 
    WHERE achievement_id IN (SELECT achievement_id FROM deleted);
END;
GO

ALTER TABLE [dbo].[ResearchAchievements] ENABLE TRIGGER [trg_cascade_delete_auth]
GO


