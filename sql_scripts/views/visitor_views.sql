USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.v_VisitorReservationStatus', N'V') IS NOT NULL DROP VIEW dbo.v_VisitorReservationStatus;
IF OBJECT_ID(N'dbo.v_AreaFlowControlStatus', N'V') IS NOT NULL DROP VIEW dbo.v_AreaFlowControlStatus;
IF OBJECT_ID(N'dbo.v_VisitorOutOfRouteTracksRecent', N'V') IS NOT NULL DROP VIEW dbo.v_VisitorOutOfRouteTracksRecent;
GO

CREATE VIEW dbo.v_VisitorReservationStatus
AS
SELECT TOP (200)
    r.ReservationId,
    r.ReserveDate,
    r.TimeSlot,
    r.PartySize,
    r.ReserveStatus,
    r.TicketAmount,
    r.PayStatus,
    v.VisitorId,
    v.VisitorName,
    v.IdCardNo,
    v.Phone
FROM dbo.Reservations r
JOIN dbo.Visitors v ON v.VisitorId = r.VisitorId
ORDER BY r.ReservationId DESC;
GO

CREATE VIEW dbo.v_AreaFlowControlStatus
AS
SELECT
    fc.AreaId,
    CAST(fc.AreaId AS NVARCHAR(50)) AS AreaName,
    fc.DailyMaxCapacity,
    fc.CurrentInPark,
    fc.WarningThreshold,
    fc.CurrentStatus
FROM dbo.FlowControls fc;
GO

CREATE VIEW dbo.v_VisitorOutOfRouteTracksRecent
AS
SELECT TOP (200)
    t.TrackId,
    t.LocateTime,
    CAST(t.AreaId AS NVARCHAR(50)) AS AreaName,
    v.VisitorName,
    v.IdCardNo,
    t.Latitude,
    t.Longitude
FROM dbo.VisitorTracks t
JOIN dbo.Visitors v ON v.VisitorId = t.VisitorId
WHERE t.IsOutOfRoute = 1
ORDER BY t.LocateTime DESC;
GO

IF OBJECT_ID(N'dbo.Areas', N'U') IS NOT NULL
BEGIN
    EXEC(N'
    ALTER VIEW dbo.v_AreaFlowControlStatus
    AS
    SELECT
        fc.AreaId,
        a.AreaName,
        fc.DailyMaxCapacity,
        fc.CurrentInPark,
        fc.WarningThreshold,
        fc.CurrentStatus
    FROM dbo.FlowControls fc
    JOIN dbo.Areas a ON a.AreaId = fc.AreaId;
    ');

    EXEC(N'
    ALTER VIEW dbo.v_VisitorOutOfRouteTracksRecent
    AS
    SELECT TOP (200)
        t.TrackId,
        t.LocateTime,
        a.AreaName,
        v.VisitorName,
        v.IdCardNo,
        t.Latitude,
        t.Longitude
    FROM dbo.VisitorTracks t
    JOIN dbo.Visitors v ON v.VisitorId = t.VisitorId
    JOIN dbo.Areas a ON a.AreaId = t.AreaId
    WHERE t.IsOutOfRoute = 1
    ORDER BY t.LocateTime DESC;
    ');
END
