USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.VisitorTracks', N'U') IS NOT NULL
    PRINT N'dbo.VisitorTracks exists';
IF OBJECT_ID(N'dbo.Visits', N'U') IS NOT NULL
    PRINT N'dbo.Visits exists';
IF OBJECT_ID(N'dbo.Reservations', N'U') IS NOT NULL
    PRINT N'dbo.Reservations exists';
IF OBJECT_ID(N'dbo.Visitors', N'U') IS NOT NULL
    PRINT N'dbo.Visitors exists';
IF OBJECT_ID(N'dbo.FlowControls', N'U') IS NOT NULL
    PRINT N'dbo.FlowControls exists';
GO

IF OBJECT_ID(N'dbo.Visitors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Visitors(
        VisitorId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        VisitorName NVARCHAR(50) NOT NULL,
        IdCardNo NVARCHAR(30) NOT NULL UNIQUE,
        Phone NVARCHAR(30) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Visitors_CreatedAt DEFAULT(SYSUTCDATETIME())
    );
END
GO

IF OBJECT_ID(N'dbo.Reservations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Reservations(
        ReservationId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        VisitorId INT NOT NULL,
        ReserveDate DATE NOT NULL,
        TimeSlot NVARCHAR(20) NOT NULL,
        PartySize INT NOT NULL,
        ReserveStatus NVARCHAR(10) NOT NULL,
        TicketAmount DECIMAL(10,2) NOT NULL,
        PayStatus NVARCHAR(10) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Reservations_CreatedAt DEFAULT(SYSUTCDATETIME()),
        CONSTRAINT CK_Reservations_TimeSlot CHECK (TimeSlot IN (N'上午', N'下午', N'全天')),
        CONSTRAINT CK_Reservations_Status CHECK (ReserveStatus IN (N'待审核', N'已确认', N'已取消', N'已完成')),
        CONSTRAINT CK_Reservations_PayStatus CHECK (PayStatus IN (N'未支付', N'已支付', N'已退款')),
        CONSTRAINT CK_Reservations_PartySize CHECK (PartySize > 0 AND PartySize <= 20),
        CONSTRAINT FK_Reservations_Visitor FOREIGN KEY(VisitorId) REFERENCES dbo.Visitors(VisitorId)
    );
END
GO

IF OBJECT_ID(N'dbo.Visits', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Visits(
        VisitId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        VisitorId INT NOT NULL,
        ReservationId INT NULL,
        AreaId INT NOT NULL,
        EntryTime DATETIME2 NOT NULL,
        ExitTime DATETIME2 NULL,
        EntryMethod NVARCHAR(10) NOT NULL,
        CONSTRAINT CK_Visits_EntryMethod CHECK (EntryMethod IN (N'线上预约', N'现场购票')),
        CONSTRAINT FK_Visits_Visitor FOREIGN KEY(VisitorId) REFERENCES dbo.Visitors(VisitorId),
        CONSTRAINT FK_Visits_Reservation FOREIGN KEY(ReservationId) REFERENCES dbo.Reservations(ReservationId)
    );
END
GO

IF OBJECT_ID(N'dbo.VisitorTracks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitorTracks(
        TrackId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        VisitorId INT NOT NULL,
        VisitId INT NULL,
        LocateTime DATETIME2 NOT NULL,
        Latitude DECIMAL(9,6) NOT NULL,
        Longitude DECIMAL(9,6) NOT NULL,
        AreaId INT NOT NULL,
        IsOutOfRoute BIT NOT NULL,
        CONSTRAINT FK_VisitorTracks_Visitor FOREIGN KEY(VisitorId) REFERENCES dbo.Visitors(VisitorId),
        CONSTRAINT FK_VisitorTracks_Visit FOREIGN KEY(VisitId) REFERENCES dbo.Visits(VisitId)
    );
END
GO

IF OBJECT_ID(N'dbo.FlowControls', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FlowControls(
        AreaId INT NOT NULL PRIMARY KEY,
        DailyMaxCapacity INT NOT NULL,
        CurrentInPark INT NOT NULL CONSTRAINT DF_FlowControls_CurrentInPark DEFAULT(0),
        WarningRatio DECIMAL(5,2) NOT NULL CONSTRAINT DF_FlowControls_WarningRatio DEFAULT(0.80),
        WarningThreshold AS CAST(ROUND(DailyMaxCapacity * WarningRatio, 0) AS INT) PERSISTED,
        CurrentStatus NVARCHAR(10) NOT NULL CONSTRAINT DF_FlowControls_CurrentStatus DEFAULT(N'正常'),
        CONSTRAINT CK_FlowControls_Status CHECK (CurrentStatus IN (N'正常', N'预警', N'限流')),
        CONSTRAINT CK_FlowControls_Capacity CHECK (DailyMaxCapacity > 0),
        CONSTRAINT CK_FlowControls_Current CHECK (CurrentInPark >= 0)
    );
END
GO

IF OBJECT_ID(N'dbo.Reservations', N'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'IX_Reservations_Visitor_Date' AND object_id = OBJECT_ID(N'dbo.Reservations')
)
    CREATE INDEX IX_Reservations_Visitor_Date ON dbo.Reservations(VisitorId, ReserveDate);

IF OBJECT_ID(N'dbo.Visits', N'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'IX_Visits_Area_EntryTime' AND object_id = OBJECT_ID(N'dbo.Visits')
)
    CREATE INDEX IX_Visits_Area_EntryTime ON dbo.Visits(AreaId, EntryTime);

IF OBJECT_ID(N'dbo.VisitorTracks', N'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'IX_VisitorTracks_Visitor_Time' AND object_id = OBJECT_ID(N'dbo.VisitorTracks')
)
    CREATE INDEX IX_VisitorTracks_Visitor_Time ON dbo.VisitorTracks(VisitorId, LocateTime);

IF OBJECT_ID(N'dbo.VisitorTracks', N'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'IX_VisitorTracks_Area_Time' AND object_id = OBJECT_ID(N'dbo.VisitorTracks')
)
    CREATE INDEX IX_VisitorTracks_Area_Time ON dbo.VisitorTracks(AreaId, LocateTime);
GO
