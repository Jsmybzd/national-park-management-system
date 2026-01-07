-- environment_seed.sql
-- 环境监测模块种子数据
USE NationalParkDB;
GO

-- 1. 插入监测指标数据
IF NOT EXISTS (SELECT 1 FROM 环境监测指标表 WHERE index_id = 'AIR_PM25')
BEGIN
    INSERT INTO 环境监测指标表 (index_id, index_name, unit, upper_threshold, lower_threshold, monitor_frequency)
    VALUES 
    ('AIR_PM25', N'空气质量PM2.5', N'μg/m³', 75, 0, N'小时'),
    ('AIR_PM10', N'空气质量PM10', N'μg/m³', 150, 0, N'小时'),
    ('AIR_CO2', N'二氧化碳浓度', N'ppm', 1000, 350, N'小时'),
    ('WATER_PH', N'水质pH值', N'pH', 8.5, 6.5, N'日'),
    ('WATER_DO', N'溶解氧', N'mg/L', 12, 5, N'日'),
    ('WATER_TURB', N'水体浊度', N'NTU', 10, 0, N'日'),
    ('SOIL_MOIST', N'土壤湿度', N'%', 80, 20, N'日'),
    ('SOIL_TEMP', N'土壤温度', N'℃', 35, 5, N'日'),
    ('NOISE_LEVEL', N'噪声水平', N'dB', 70, 30, N'小时'),
    ('LIGHT_INTENS', N'光照强度', N'lux', 100000, 0, N'小时');
    PRINT N'已插入10条监测指标数据';
END
ELSE
BEGIN
    PRINT N'监测指标数据已存在';
END
GO

-- 2. 确保监测设备表有环境监测设备
IF NOT EXISTS (SELECT 1 FROM 监测设备表 WHERE type = N'空气质量传感器' AND deployment_area_id = 1)
BEGIN
    INSERT INTO 监测设备表 (type, deployment_area_id, install_time, calibration_cycle, status, communication_protocol, last_calibration_time)
    VALUES 
    (N'空气质量传感器', 1, '2024-01-10', 30, N'正常', N'LORA', '2024-12-01'),
    (N'空气质量传感器', 2, '2024-01-15', 30, N'正常', N'4G', '2024-12-05'),
    (N'水质监测仪', 2, '2024-02-01', 60, N'正常', N'4G', '2024-11-15'),
    (N'水质监测仪', 3, '2024-02-10', 60, N'正常', N'WIFI', '2024-11-20'),
    (N'土壤湿度传感器', 1, '2024-03-01', 90, N'正常', N'LORA', '2024-10-01'),
    (N'土壤湿度传感器', 3, '2024-03-05', 90, N'故障', N'LORA', '2024-09-15'),
    (N'气象站', 1, '2024-01-01', 180, N'正常', N'卫星', '2024-07-01'),
    (N'气象站', 2, '2024-01-05', 180, N'正常', N'卫星', '2024-07-05');
    PRINT N'已插入8条环境监测设备数据';
END
ELSE
BEGIN
    PRINT N'环境监测设备数据已存在';
END
GO

-- 3. 插入一些示例监测数据
DECLARE @device_id INT;
DECLARE @now DATETIME = GETDATE();

-- 获取空气质量传感器ID
SELECT TOP 1 @device_id = id FROM 监测设备表 WHERE type = N'空气质量传感器' ORDER BY id;

IF @device_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM 环境监测数据表 WHERE index_id = 'AIR_PM25' AND device_id = @device_id)
BEGIN
    INSERT INTO 环境监测数据表 (data_id, index_id, device_id, collect_time, monitor_value, area_id, data_quality, is_abnormal)
    VALUES 
    ('ED_' + FORMAT(@now, 'yyyyMMddHHmmss') + '_001', 'AIR_PM25', @device_id, DATEADD(HOUR, -5, @now), 35.2, 1, N'优', 0),
    ('ED_' + FORMAT(@now, 'yyyyMMddHHmmss') + '_002', 'AIR_PM25', @device_id, DATEADD(HOUR, -4, @now), 42.8, 1, N'优', 0),
    ('ED_' + FORMAT(@now, 'yyyyMMddHHmmss') + '_003', 'AIR_PM25', @device_id, DATEADD(HOUR, -3, @now), 58.5, 1, N'良', 0),
    ('ED_' + FORMAT(@now, 'yyyyMMddHHmmss') + '_004', 'AIR_PM25', @device_id, DATEADD(HOUR, -2, @now), 78.3, 1, N'中', 1),
    ('ED_' + FORMAT(@now, 'yyyyMMddHHmmss') + '_005', 'AIR_PM25', @device_id, DATEADD(HOUR, -1, @now), 65.1, 1, N'良', 0);
    PRINT N'已插入5条空气质量监测数据';
END
GO

-- 获取水质监测仪ID
DECLARE @water_device_id INT;
DECLARE @now2 DATETIME = GETDATE();
SELECT TOP 1 @water_device_id = id FROM 监测设备表 WHERE type = N'水质监测仪' ORDER BY id;

IF @water_device_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM 环境监测数据表 WHERE index_id = 'WATER_PH' AND device_id = @water_device_id)
BEGIN
    INSERT INTO 环境监测数据表 (data_id, index_id, device_id, collect_time, monitor_value, area_id, data_quality, is_abnormal)
    VALUES 
    ('ED_' + FORMAT(@now2, 'yyyyMMddHHmmss') + '_W01', 'WATER_PH', @water_device_id, DATEADD(DAY, -3, @now2), 7.2, 2, N'优', 0),
    ('ED_' + FORMAT(@now2, 'yyyyMMddHHmmss') + '_W02', 'WATER_PH', @water_device_id, DATEADD(DAY, -2, @now2), 7.5, 2, N'优', 0),
    ('ED_' + FORMAT(@now2, 'yyyyMMddHHmmss') + '_W03', 'WATER_PH', @water_device_id, DATEADD(DAY, -1, @now2), 6.3, 2, N'中', 1),
    ('ED_' + FORMAT(@now2, 'yyyyMMddHHmmss') + '_W04', 'WATER_PH', @water_device_id, @now2, 7.1, 2, N'优', 0);
    PRINT N'已插入4条水质监测数据';
END
GO

PRINT N'环境监测种子数据初始化完成';
GO
