-- 游客模块种子数据
USE NationalParkDB;
GO

PRINT N'=== 插入游客模块种子数据 ===';

-- 1. 插入流量控制数据
IF NOT EXISTS (SELECT 1 FROM dbo.FlowControls WHERE AreaId = 1)
BEGIN
    INSERT INTO dbo.FlowControls (AreaId, DailyMaxCapacity, CurrentInPark, WarningRatio, CurrentStatus)
    VALUES 
        (1, 500, 120, 0.80, N'正常'),
        (2, 800, 280, 0.80, N'正常'),
        (3, 600, 150, 0.80, N'正常'),
        (4, 300, 100, 0.80, N'正常'),
        (5, 1000, 650, 0.80, N'正常');
    PRINT N'流量控制数据插入成功';
END
GO

-- 2. 插入游客数据
IF NOT EXISTS (SELECT 1 FROM dbo.Visitors WHERE IdCardNo = '110101199001011234')
BEGIN
    INSERT INTO dbo.Visitors (VisitorName, IdCardNo, Phone)
    VALUES 
        (N'张三', '110101199001011234', '13800000007'),
        (N'李明', '110101199202022345', '13900001111'),
        (N'王芳', '110101199303033456', '13900002222'),
        (N'赵强', '110101199404044567', '13900003333'),
        (N'刘洋', '110101199505055678', '13900004444'),
        (N'陈静', '110101199606066789', '13900005555'),
        (N'杨帆', '110101199707077890', '13900006666'),
        (N'周磊', '110101199808088901', '13900007777');
    PRINT N'游客数据插入成功';
END
GO

-- 3. 插入预约数据
DECLARE @visitor1 INT, @visitor2 INT, @visitor3 INT, @visitor4 INT;
SELECT @visitor1 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199001011234';
SELECT @visitor2 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199202022345';
SELECT @visitor3 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199303033456';
SELECT @visitor4 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199404044567';

IF @visitor1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Reservations WHERE VisitorId = @visitor1)
BEGIN
    INSERT INTO dbo.Reservations (VisitorId, ReserveDate, TimeSlot, PartySize, ReserveStatus, TicketAmount, PayStatus)
    VALUES 
        (@visitor1, DATEADD(DAY, 1, CAST(GETDATE() AS DATE)), N'上午', 2, N'已确认', 100.00, N'已支付'),
        (@visitor1, DATEADD(DAY, 3, CAST(GETDATE() AS DATE)), N'全天', 1, N'已确认', 50.00, N'已支付');
    PRINT N'游客1预约数据插入成功';
END

IF @visitor2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Reservations WHERE VisitorId = @visitor2)
BEGIN
    INSERT INTO dbo.Reservations (VisitorId, ReserveDate, TimeSlot, PartySize, ReserveStatus, TicketAmount, PayStatus)
    VALUES 
        (@visitor2, DATEADD(DAY, 1, CAST(GETDATE() AS DATE)), N'下午', 3, N'已确认', 150.00, N'已支付'),
        (@visitor2, DATEADD(DAY, 5, CAST(GETDATE() AS DATE)), N'上午', 2, N'已确认', 100.00, N'未支付');
    PRINT N'游客2预约数据插入成功';
END

IF @visitor3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Reservations WHERE VisitorId = @visitor3)
BEGIN
    INSERT INTO dbo.Reservations (VisitorId, ReserveDate, TimeSlot, PartySize, ReserveStatus, TicketAmount, PayStatus)
    VALUES 
        (@visitor3, DATEADD(DAY, 2, CAST(GETDATE() AS DATE)), N'全天', 4, N'已确认', 200.00, N'已支付');
    PRINT N'游客3预约数据插入成功';
END

IF @visitor4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Reservations WHERE VisitorId = @visitor4)
BEGIN
    INSERT INTO dbo.Reservations (VisitorId, ReserveDate, TimeSlot, PartySize, ReserveStatus, TicketAmount, PayStatus)
    VALUES 
        (@visitor4, CAST(GETDATE() AS DATE), N'上午', 2, N'已取消', 100.00, N'已退款');
    PRINT N'游客4预约数据插入成功';
END
GO

-- 4. 插入入园记录
DECLARE @v1 INT, @v2 INT, @r1 INT, @r2 INT;
SELECT @v1 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199202022345';
SELECT @v2 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199303033456';
SELECT TOP 1 @r1 = ReservationId FROM dbo.Reservations WHERE VisitorId = @v1;
SELECT TOP 1 @r2 = ReservationId FROM dbo.Reservations WHERE VisitorId = @v2;

IF @v1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Visits WHERE VisitorId = @v1)
BEGIN
    INSERT INTO dbo.Visits (VisitorId, ReservationId, AreaId, EntryTime, ExitTime, EntryMethod)
    VALUES 
        (@v1, @r1, 5, DATEADD(HOUR, -3, GETDATE()), NULL, N'线上预约');
    PRINT N'入园记录1插入成功';
END

IF @v2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Visits WHERE VisitorId = @v2)
BEGIN
    INSERT INTO dbo.Visits (VisitorId, ReservationId, AreaId, EntryTime, ExitTime, EntryMethod)
    VALUES 
        (@v2, @r2, 5, DATEADD(HOUR, -5, GETDATE()), DATEADD(HOUR, -1, GETDATE()), N'线上预约');
    PRINT N'入园记录2插入成功';
END
GO

-- 5. 插入轨迹数据
DECLARE @vis1 INT, @vis2 INT, @visit1 INT, @visit2 INT;
SELECT @vis1 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199202022345';
SELECT @vis2 = VisitorId FROM dbo.Visitors WHERE IdCardNo = '110101199303033456';
SELECT TOP 1 @visit1 = VisitId FROM dbo.Visits WHERE VisitorId = @vis1;
SELECT TOP 1 @visit2 = VisitId FROM dbo.Visits WHERE VisitorId = @vis2;

IF @vis1 IS NOT NULL AND @visit1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.VisitorTracks WHERE VisitorId = @vis1)
BEGIN
    INSERT INTO dbo.VisitorTracks (VisitorId, VisitId, LocateTime, Latitude, Longitude, AreaId, IsOutOfRoute)
    VALUES 
        (@vis1, @visit1, DATEADD(HOUR, -3, GETDATE()), 30.2100, 103.5100, 5, 0),
        (@vis1, @visit1, DATEADD(HOUR, -2, GETDATE()), 30.2200, 103.5200, 1, 0),
        (@vis1, @visit1, DATEADD(MINUTE, -90, GETDATE()), 30.2300, 103.5300, 2, 0),
        (@vis1, @visit1, DATEADD(MINUTE, -30, GETDATE()), 30.2500, 103.5500, 1, 1);
    PRINT N'游客轨迹1插入成功';
END

IF @vis2 IS NOT NULL AND @visit2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.VisitorTracks WHERE VisitorId = @vis2)
BEGIN
    INSERT INTO dbo.VisitorTracks (VisitorId, VisitId, LocateTime, Latitude, Longitude, AreaId, IsOutOfRoute)
    VALUES 
        (@vis2, @visit2, DATEADD(HOUR, -5, GETDATE()), 30.2100, 103.5100, 5, 0),
        (@vis2, @visit2, DATEADD(HOUR, -4, GETDATE()), 30.2150, 103.5150, 2, 0),
        (@vis2, @visit2, DATEADD(HOUR, -3, GETDATE()), 30.2200, 103.5200, 3, 0),
        (@vis2, @visit2, DATEADD(HOUR, -2, GETDATE()), 30.2100, 103.5100, 5, 0);
    PRINT N'游客轨迹2插入成功';
END
GO

PRINT N'=== 游客模块种子数据插入完成 ===';
GO
