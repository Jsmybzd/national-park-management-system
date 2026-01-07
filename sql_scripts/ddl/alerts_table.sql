-- 预警信息表
USE NationalParkDB;
GO

-- 创建预警表
IF OBJECT_ID(N'dbo.Alerts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Alerts(
        AlertId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AlertType NVARCHAR(50) NOT NULL,           -- 预警类型：游客越界/流量预警/流量限流
        SourceTable NVARCHAR(50) NULL,             -- 来源表
        SourceId INT NULL,                          -- 来源记录ID
        AreaId INT NULL,                            -- 相关区域
        VisitorId INT NULL,                         -- 相关游客
        Severity NVARCHAR(10) NOT NULL DEFAULT N'中', -- 严重程度：低/中/高
        Message NVARCHAR(500) NOT NULL,             -- 预警消息
        Status NVARCHAR(10) NOT NULL DEFAULT N'未处理', -- 状态：未处理/已处理/已忽略
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        HandledAt DATETIME2 NULL,
        HandledBy INT NULL,                         -- 处理人员用户ID
        CONSTRAINT CK_Alerts_Severity CHECK (Severity IN (N'低', N'中', N'高')),
        CONSTRAINT CK_Alerts_Status CHECK (Status IN (N'未处理', N'已处理', N'已忽略'))
    );
    PRINT N'Alerts表创建成功';
END
GO

-- 索引
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Alerts_Status_CreatedAt' AND object_id = OBJECT_ID(N'dbo.Alerts'))
    CREATE INDEX IX_Alerts_Status_CreatedAt ON dbo.Alerts(Status, CreatedAt DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Alerts_AreaId' AND object_id = OBJECT_ID(N'dbo.Alerts'))
    CREATE INDEX IX_Alerts_AreaId ON dbo.Alerts(AreaId);
GO

PRINT N'Alerts表及索引创建完成';
GO
