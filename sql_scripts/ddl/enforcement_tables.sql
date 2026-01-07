USE NationalParkDB;
GO

IF OBJECT_ID(N'dbo.[执法人员信息表]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[执法人员信息表] (
        [law_enforcement_id] VARCHAR(20) NOT NULL PRIMARY KEY,
        [staff_name] VARCHAR(20) NOT NULL,
        [department] VARCHAR(30) NOT NULL,
        [permission] VARCHAR(200) NULL,
        [contact] CHAR(11) NOT NULL,
        [equipment_number] VARCHAR(30) NULL,
        CONSTRAINT [CK_执法人员信息表_contact] CHECK ([contact] LIKE '1[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
    );
END
GO

IF OBJECT_ID(N'dbo.[视频监控点信息表]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[视频监控点信息表] (
        [monitor_point_id] VARCHAR(30) NOT NULL PRIMARY KEY,
        [area_number] VARCHAR(20) NOT NULL,
        [install_location_lng] DECIMAL(10,6) NOT NULL,
        [install_location_lat] DECIMAL(10,6) NOT NULL,
        [monitor_range] VARCHAR(200) NULL,
        [device_status] VARCHAR(20) NOT NULL CONSTRAINT [DF_视频监控点信息表_device_status] DEFAULT ('正常'),
        [data_storage_cycle] INT NOT NULL CONSTRAINT [DF_视频监控点信息表_data_storage_cycle] DEFAULT (90)
    );
END
GO

IF OBJECT_ID(N'dbo.[非法行为记录表]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[非法行为记录表] (
        [record_id] VARCHAR(30) NOT NULL PRIMARY KEY,
        [behavior_type] VARCHAR(50) NOT NULL,
        [occur_time] DATETIME NOT NULL,
        [area_number] VARCHAR(20) NOT NULL,
        [evidence_path] VARCHAR(500) NOT NULL,
        [handle_status] VARCHAR(20) NOT NULL CONSTRAINT [DF_非法行为记录表_handle_status] DEFAULT ('未处理'),
        [law_enforcement_id] VARCHAR(20) NULL,
        [handle_result] VARCHAR(500) NULL,
        [punishment_basis] VARCHAR(500) NULL,
        [monitor_point_id] VARCHAR(30) NOT NULL,
        CONSTRAINT [CK_非法行为记录表_handle_status] CHECK ([handle_status] IN ('未处理', '处理中', '已结案')),
        CONSTRAINT [FK_非法行为记录表_执法人员信息表] FOREIGN KEY ([law_enforcement_id]) REFERENCES dbo.[执法人员信息表]([law_enforcement_id]),
        CONSTRAINT [FK_非法行为记录表_视频监控点信息表] FOREIGN KEY ([monitor_point_id]) REFERENCES dbo.[视频监控点信息表]([monitor_point_id])
    );
END
GO

IF OBJECT_ID(N'dbo.[非法行为记录表]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.[非法行为记录表]')
          AND name = 'law_enforcement_id'
          AND is_nullable = 0
    )
    BEGIN
        ALTER TABLE dbo.[非法行为记录表] ALTER COLUMN [law_enforcement_id] VARCHAR(20) NULL;
    END
END
GO

IF OBJECT_ID(N'dbo.[执法调度信息表]', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.[执法调度信息表] (
        [dispatch_id] VARCHAR(30) NOT NULL PRIMARY KEY,
        [record_id] VARCHAR(30) NOT NULL,
        [law_enforcement_id] VARCHAR(20) NOT NULL,
        [dispatch_time] DATETIME NOT NULL,
        [response_time] DATETIME NULL,
        [complete_time] DATETIME NULL,
        [dispatch_status] VARCHAR(20) NOT NULL CONSTRAINT [DF_执法调度信息表_dispatch_status] DEFAULT ('待响应'),
        CONSTRAINT [CK_执法调度信息表_dispatch_status] CHECK ([dispatch_status] IN ('待响应', '已派单', '已完成', '已响应', '已取消')),
        CONSTRAINT [FK_执法调度信息表_非法行为记录表] FOREIGN KEY ([record_id]) REFERENCES dbo.[非法行为记录表]([record_id]),
        CONSTRAINT [FK_执法调度信息表_执法人员信息表] FOREIGN KEY ([law_enforcement_id]) REFERENCES dbo.[执法人员信息表]([law_enforcement_id])
    );
END
GO
