USE NationalParkDB;
GO

CREATE OR ALTER VIEW dbo.V_非法行为案件完整信息
AS
SELECT 
    ir.record_id AS 案件编号,
    ir.behavior_type AS 违法行为类型,
    ir.occur_time AS 违法发生时间,
    ir.area_number AS 违法区域编号,
    ir.evidence_path AS 证据文件路径,
    ir.handle_status AS 案件处理状态,
    ir.handle_result AS 处理结果,
    ir.punishment_basis AS 处罚依据,
    ls.law_enforcement_id AS 执法人员ID,
    ls.staff_name AS 执法人员姓名,
    ls.department AS 所属部门,
    vmp.monitor_point_id AS 监控点位ID,
    vmp.install_location_lng AS 点位经度,
    vmp.install_location_lat AS 点位纬度,
    vmp.device_status AS 设备状态,
    ld.dispatch_time AS 派单时间,
    ld.response_time AS 响应时间,
    ld.complete_time AS 完成时间,
    ld.dispatch_status AS 调度状态
FROM dbo.[非法行为记录表] ir
LEFT JOIN dbo.[执法人员信息表] ls ON ir.law_enforcement_id = ls.law_enforcement_id
LEFT JOIN dbo.[视频监控点信息表] vmp ON ir.monitor_point_id = vmp.monitor_point_id
LEFT JOIN dbo.[执法调度信息表] ld ON ir.record_id = ld.record_id;
GO

CREATE OR ALTER VIEW dbo.V_执法人员案件处理统计
AS
SELECT 
    ls.law_enforcement_id AS 执法人员ID,
    ls.staff_name AS 执法人员姓名,
    ls.department AS 所属部门,
    COUNT(ir.record_id) AS 处理案件总数,
    SUM(CASE WHEN ir.handle_status = '未处理' THEN 1 ELSE 0 END) AS 未处理案件数,
    SUM(CASE WHEN ir.handle_status = '处理中' THEN 1 ELSE 0 END) AS 处理中案件数,
    SUM(CASE WHEN ir.handle_status = '已结案' THEN 1 ELSE 0 END) AS 已结案案件数,
    CASE WHEN COUNT(ir.record_id) = 0 THEN 0 
         ELSE CAST(SUM(CASE WHEN ir.handle_status = '已结案' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(ir.record_id) * 100 
    END AS 案件结案率
FROM dbo.[执法人员信息表] ls
LEFT JOIN dbo.[非法行为记录表] ir ON ls.law_enforcement_id = ir.law_enforcement_id
GROUP BY ls.law_enforcement_id, ls.staff_name, ls.department;
GO

CREATE OR ALTER VIEW dbo.V_监控点位违法高发统计
AS
SELECT 
    vmp.monitor_point_id AS 监控点位ID,
    vmp.area_number AS 区域编号,
    vmp.install_location_lng AS 经度,
    vmp.install_location_lat AS 纬度,
    vmp.device_status AS 设备状态,
    COUNT(ir.record_id) AS 违法案件总数,
    MAX(CASE WHEN bt.rn = 1 THEN bt.behavior_type END) AS 主要违法类型
FROM dbo.[视频监控点信息表] vmp
LEFT JOIN dbo.[非法行为记录表] ir ON vmp.monitor_point_id = ir.monitor_point_id
LEFT JOIN (
    SELECT monitor_point_id, behavior_type,
           ROW_NUMBER() OVER (PARTITION BY monitor_point_id ORDER BY COUNT(*) DESC) AS rn
    FROM dbo.[非法行为记录表]
    GROUP BY monitor_point_id, behavior_type
) AS bt ON vmp.monitor_point_id = bt.monitor_point_id AND bt.rn = 1
GROUP BY vmp.monitor_point_id, vmp.area_number, vmp.install_location_lng, vmp.install_location_lat, vmp.device_status;
GO

CREATE OR ALTER VIEW dbo.V_执法调度时效分析
AS
SELECT 
    ld.dispatch_id AS 调度ID,
    ir.record_id AS 案件编号,
    ls.staff_name AS 执法人员姓名,
    ld.dispatch_time AS 派单时间,
    ld.response_time AS 响应时间,
    ld.complete_time AS 完成时间,
    ld.dispatch_status AS 调度状态,
    DATEDIFF(MINUTE, ld.dispatch_time, ld.response_time) AS 响应时长_分钟,
    DATEDIFF(MINUTE, ld.dispatch_time, ld.complete_time) AS 完成时长_分钟,
    DATEDIFF(MINUTE, ir.occur_time, ld.dispatch_time) AS 案发至派单间隔_分钟
FROM dbo.[执法调度信息表] ld
LEFT JOIN dbo.[非法行为记录表] ir ON ld.record_id = ir.record_id
LEFT JOIN dbo.[执法人员信息表] ls ON ld.law_enforcement_id = ls.law_enforcement_id;
GO
