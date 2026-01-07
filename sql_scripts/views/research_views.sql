USE NationalParkDB;
GO

CREATE OR ALTER VIEW dbo.V_科研项目概览
AS
SELECT
    p.project_id,
    p.project_name,
    p.leader_id,
    p.apply_unit,
    p.approval_date,
    p.conclusion_date,
    p.status,
    p.research_field,
    COUNT(DISTINCT c.collection_id) AS collection_count,
    COUNT(DISTINCT a.achievement_id) AS achievement_count
FROM dbo.ResearchProjects p
LEFT JOIN dbo.DataCollections c ON c.project_id = p.project_id
LEFT JOIN dbo.ResearchAchievements a ON a.project_id = p.project_id
GROUP BY
    p.project_id,
    p.project_name,
    p.leader_id,
    p.apply_unit,
    p.approval_date,
    p.conclusion_date,
    p.status,
    p.research_field;
GO

CREATE OR ALTER VIEW dbo.V_科研成果概览
AS
SELECT
    a.achievement_id,
    a.project_id,
    p.project_name,
    a.achievement_type,
    a.title,
    a.publish_date,
    a.share_permission,
    a.file_path,
    COUNT(auth.access_id) AS authorized_count
FROM dbo.ResearchAchievements a
LEFT JOIN dbo.ResearchProjects p ON p.project_id = a.project_id
LEFT JOIN dbo.AuthorizedAccesses auth ON auth.achievement_id = a.achievement_id
GROUP BY
    a.achievement_id,
    a.project_id,
    p.project_name,
    a.achievement_type,
    a.title,
    a.publish_date,
    a.share_permission,
    a.file_path;
GO
