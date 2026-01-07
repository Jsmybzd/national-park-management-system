-- shared_tables.sql
USE NationalParkDB;
GO

-- 1. 区域表（所有业务线共享）
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=N'区域表' AND xtype='U')
BEGIN
    CREATE TABLE 区域表 (
        id INT PRIMARY KEY IDENTITY(1,1),
        name NVARCHAR(100) NOT NULL,
        type NVARCHAR(20) NOT NULL CHECK (type IN (N'森林', N'湿地', N'草原', N'荒漠', N'山地', N'水域', N'核心保护区', N'缓冲区', N'实验区')),
        area FLOAT NOT NULL,
        main_protect NVARCHAR(MAX),
        main_species_id INT NULL,
        suitable_score FLOAT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
    PRINT N'区域表创建成功';
END
ELSE
BEGIN
    PRINT N'区域表已存在';
END
GO

-- 确保区域表的 type 约束覆盖环境业务线（幂等处理）
IF OBJECT_ID(N'区域表', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_区域表_type' AND parent_object_id = OBJECT_ID(N'区域表'))
    BEGIN
        DECLARE @ck_area_type sysname;
        SELECT TOP 1 @ck_area_type = cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID(N'区域表')
          AND cc.definition LIKE '%type%IN%';

        IF @ck_area_type IS NOT NULL
        BEGIN
            DECLARE @sql_drop_ck_area NVARCHAR(MAX) = N'ALTER TABLE 区域表 DROP CONSTRAINT [' + @ck_area_type + N']';
            EXEC sp_executesql @sql_drop_ck_area;
        END

        ALTER TABLE 区域表 ADD CONSTRAINT CK_区域表_type
        CHECK (type IN (N'森林', N'湿地', N'草原', N'荒漠', N'山地', N'水域', N'核心保护区', N'缓冲区', N'实验区'));
    END
END
GO

-- 2. 监测设备表（biodiversity、environment共享）
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=N'监测设备表' AND xtype='U')
BEGIN
    CREATE TABLE 监测设备表 (
        id INT PRIMARY KEY IDENTITY(1,1),
        type NVARCHAR(50) NOT NULL CHECK (type IN (N'空气质量传感器', N'水质监测仪', N'土壤湿度传感器', N'红外相机', N'无人机', N'气象站')),
        deployment_area_id INT NULL,
        install_time DATETIME NOT NULL,
        calibration_cycle INT DEFAULT 30,
        last_calibration_time DATETIME NULL,
        status NVARCHAR(10) DEFAULT N'正常' CHECK (status IN (N'正常', N'故障', N'离线')),
        communication_protocol NVARCHAR(50),
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),

        CONSTRAINT FK_监测设备_区域 FOREIGN KEY (deployment_area_id)
            REFERENCES 区域表(id) ON DELETE SET NULL
    );
    PRINT N'监测设备表创建成功';
END
ELSE
BEGIN
    PRINT N'监测设备表已存在';
END
GO

-- 监测设备表补列（幂等）
IF OBJECT_ID(N'监测设备表', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'监测设备表', N'last_calibration_time') IS NULL
        ALTER TABLE 监测设备表 ADD last_calibration_time DATETIME NULL;

    IF COL_LENGTH(N'监测设备表', N'latitude') IS NULL
        ALTER TABLE 监测设备表 ADD latitude FLOAT NULL;

    IF COL_LENGTH(N'监测设备表', N'longitude') IS NULL
        ALTER TABLE 监测设备表 ADD longitude FLOAT NULL;
END
GO

-- 插入示例区域数据（至少5个区域）
IF (SELECT COUNT(*) FROM 区域表) = 0
BEGIN
    INSERT INTO 区域表 (name, type, area, main_protect, suitable_score) VALUES
    (N'大熊猫核心栖息地', N'森林', 5000, N'严格保护，禁止游客进入', 92.5),
    (N'湿地生态观测区', N'湿地', 3000, N'生态监测，限制性开放', 88.0),
    (N'高山草甸带', N'草原', 4500, N'季节性开放，科研优先', 76.5),
    (N'荒漠过渡区', N'荒漠', 6000, N'生态恢复实验区', 65.0),
    (N'水源涵养林', N'森林', 3500, N'水源保护，禁止污染', 95.0),
    (N'游客主景区', N'森林', 2000, N'旅游开放，流量控制', 85.0),
    (N'科研实验区', N'山地', 4000, N'科研专用，需审批', 70.0),
    (N'野生动物迁徙通道', N'草原', 5500, N'生态廊道，禁止开发', 90.0);

    PRINT N'已插入8条区域数据';
END
ELSE
BEGIN
    PRINT N'区域表已有数据，跳过插入';
END
GO

-- 插入示例设备数据
IF (SELECT COUNT(*) FROM 监测设备表) = 0
BEGIN
    INSERT INTO 监测设备表 (type, deployment_area_id, install_time, status, communication_protocol) VALUES
    (N'红外相机', 1, '2024-01-15', N'正常', N'4G'),
    (N'红外相机', 1, '2024-01-16', N'正常', N'4G'),
    (N'红外相机', 3, '2024-01-20', N'正常', N'WIFI'),
    (N'空气质量传感器', 2, '2024-02-01', N'正常', N'LORA'),
    (N'水质监测仪', 2, '2024-02-05', N'正常', N'4G'),
    (N'无人机', NULL, '2024-02-10', N'正常', N'4G'),
    (N'气象站', 5, '2024-02-15', N'正常', N'卫星'),
    (N'土壤湿度传感器', 3, '2024-02-20', N'正常', N'LORA'),
    (N'红外相机', 8, '2024-03-01', N'故障', N'4G'),
    (N'水质监测仪', 4, '2024-03-05', N'正常', N'4G');

    PRINT N'已插入10条设备数据';
END
ELSE
BEGIN
    PRINT N'监测设备表已有数据，跳过插入';
END
GO
