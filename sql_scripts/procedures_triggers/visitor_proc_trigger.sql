USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.sp_RecalcFlowControl', N'P') IS NOT NULL DROP PROCEDURE dbo.sp_RecalcFlowControl;
GO

CREATE PROCEDURE dbo.sp_RecalcFlowControl
    @AreaId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @AreaId IS NULL
    BEGIN
        UPDATE fc
        SET CurrentInPark = v.cnt,
            CurrentStatus = CASE 
                WHEN v.cnt >= fc.DailyMaxCapacity THEN N'限流'
                WHEN v.cnt >= fc.WarningThreshold THEN N'预警'
                ELSE N'正常' END
        FROM dbo.FlowControls fc
        JOIN (
            SELECT AreaId, COUNT(1) AS cnt
            FROM dbo.Visits
            WHERE ExitTime IS NULL
            GROUP BY AreaId
        ) v ON v.AreaId = fc.AreaId;

        UPDATE fc
        SET CurrentInPark = 0,
            CurrentStatus = N'正常'
        FROM dbo.FlowControls fc
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.Visits v WHERE v.AreaId = fc.AreaId AND v.ExitTime IS NULL
        );
        RETURN;
    END

    DECLARE @cnt INT = (
        SELECT COUNT(1) FROM dbo.Visits WHERE AreaId=@AreaId AND ExitTime IS NULL
    );

    UPDATE dbo.FlowControls
    SET CurrentInPark = ISNULL(@cnt, 0),
        CurrentStatus = CASE 
            WHEN ISNULL(@cnt, 0) >= DailyMaxCapacity THEN N'限流'
            WHEN ISNULL(@cnt, 0) >= WarningThreshold THEN N'预警'
            ELSE N'正常' END
    WHERE AreaId=@AreaId;
END
GO

IF OBJECT_ID(N'dbo.TR_Visits_FlowControl', N'TR') IS NOT NULL DROP TRIGGER dbo.TR_Visits_FlowControl;
GO

CREATE TRIGGER dbo.TR_Visits_FlowControl
ON dbo.Visits
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Areas TABLE(AreaId INT PRIMARY KEY);

    INSERT INTO @Areas(AreaId)
    SELECT DISTINCT AreaId FROM inserted WHERE AreaId IS NOT NULL
    UNION
    SELECT DISTINCT AreaId FROM deleted WHERE AreaId IS NOT NULL;

    DECLARE @aid INT;
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT AreaId FROM @Areas;
    OPEN c;
    FETCH NEXT FROM c INTO @aid;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_RecalcFlowControl @aid;

        FETCH NEXT FROM c INTO @aid;
    END
    CLOSE c;
    DEALLOCATE c;
END
GO

IF OBJECT_ID(N'dbo.TR_VisitorTracks_OutOfRoute_Alert', N'TR') IS NOT NULL DROP TRIGGER dbo.TR_VisitorTracks_OutOfRoute_Alert;
GO

CREATE TRIGGER dbo.TR_VisitorTracks_OutOfRoute_Alert
ON dbo.VisitorTracks
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'dbo.Alerts', N'U') IS NOT NULL
    BEGIN
        INSERT INTO dbo.Alerts(AlertType, SourceTable, SourceId, AreaId, VisitorId, Severity, Message)
        SELECT
            N'游客越界',
            N'VisitorTracks',
            i.TrackId,
            i.AreaId,
            i.VisitorId,
            N'高',
            CONCAT(N'游客轨迹越界预警：游客ID=', i.VisitorId, N'，轨迹ID=', i.TrackId, N'，区域ID=', i.AreaId)
        FROM inserted i
        WHERE i.IsOutOfRoute = 1;
    END
END
GO

-- 流量预警触发器：当流量状态变化时生成预警
IF OBJECT_ID(N'dbo.TR_FlowControls_Alert', N'TR') IS NOT NULL DROP TRIGGER dbo.TR_FlowControls_Alert;
GO

CREATE TRIGGER dbo.TR_FlowControls_Alert
ON dbo.FlowControls
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'dbo.Alerts', N'U') IS NOT NULL
    BEGIN
        -- 当状态从正常变为预警
        INSERT INTO dbo.Alerts(AlertType, SourceTable, SourceId, AreaId, Severity, Message)
        SELECT
            N'流量预警',
            N'FlowControls',
            i.AreaId,
            i.AreaId,
            N'中',
            CONCAT(N'区域流量预警：区域ID=', i.AreaId, N'，当前人数=', i.CurrentInPark, 
                   N'，预警阈值=', i.WarningThreshold, N'，最大容量=', i.DailyMaxCapacity)
        FROM inserted i
        JOIN deleted d ON i.AreaId = d.AreaId
        WHERE i.CurrentStatus = N'预警' AND d.CurrentStatus = N'正常';

        -- 当状态从预警变为限流
        INSERT INTO dbo.Alerts(AlertType, SourceTable, SourceId, AreaId, Severity, Message)
        SELECT
            N'流量限流',
            N'FlowControls',
            i.AreaId,
            i.AreaId,
            N'高',
            CONCAT(N'区域流量限流：区域ID=', i.AreaId, N'，当前人数=', i.CurrentInPark, 
                   N'已达最大容量=', i.DailyMaxCapacity, N'，请立即启动限流措施！')
        FROM inserted i
        JOIN deleted d ON i.AreaId = d.AreaId
        WHERE i.CurrentStatus = N'限流' AND d.CurrentStatus IN (N'正常', N'预警');
    END
END
GO
