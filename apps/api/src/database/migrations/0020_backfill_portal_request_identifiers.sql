UPDATE `portal_update_requests` p
JOIN (
  SELECT p1.id,
         p1.workspace_id,
         json_unquote(json_extract(p1.`payload`, '$.referenceNumber')) AS extracted_ref
  FROM `portal_update_requests` p1
  INNER JOIN (
    SELECT workspace_id,
           json_unquote(json_extract(`payload`, '$.referenceNumber')) AS ref_val
    FROM `portal_update_requests`
    WHERE `request_type` = 'admission_enquiry'
      AND `reference_number` IS NULL
      AND json_unquote(json_extract(`payload`, '$.referenceNumber')) IS NOT NULL
      AND json_unquote(json_extract(`payload`, '$.referenceNumber')) != ''
      AND json_unquote(json_extract(`payload`, '$.referenceNumber')) != 'null'
    GROUP BY workspace_id, ref_val
    HAVING count(*) = 1
  ) uniques ON p1.workspace_id = uniques.workspace_id
           AND json_unquote(json_extract(p1.`payload`, '$.referenceNumber')) = uniques.ref_val
  LEFT JOIN `portal_update_requests` existing
    ON existing.workspace_id = p1.workspace_id
   AND existing.reference_number = uniques.ref_val
  WHERE p1.`request_type` = 'admission_enquiry'
    AND p1.`reference_number` IS NULL
    AND existing.id IS NULL
) safe_candidates ON p.id = safe_candidates.id
SET p.reference_number = safe_candidates.extracted_ref;
--> statement-breakpoint
UPDATE `portal_update_requests` p
JOIN (
  SELECT p1.id,
         p1.workspace_id,
         json_unquote(json_extract(p1.`payload`, '$.applicationNumber')) AS extracted_app
  FROM `portal_update_requests` p1
  INNER JOIN (
    SELECT workspace_id,
           json_unquote(json_extract(`payload`, '$.applicationNumber')) AS app_val
    FROM `portal_update_requests`
    WHERE `request_type` = 'admission_application'
      AND `application_number` IS NULL
      AND json_unquote(json_extract(`payload`, '$.applicationNumber')) IS NOT NULL
      AND json_unquote(json_extract(`payload`, '$.applicationNumber')) != ''
      AND json_unquote(json_extract(`payload`, '$.applicationNumber')) != 'null'
    GROUP BY workspace_id, app_val
    HAVING count(*) = 1
  ) uniques ON p1.workspace_id = uniques.workspace_id
           AND json_unquote(json_extract(p1.`payload`, '$.applicationNumber')) = uniques.app_val
  LEFT JOIN `portal_update_requests` existing
    ON existing.workspace_id = p1.workspace_id
   AND existing.application_number = uniques.app_val
  WHERE p1.`request_type` = 'admission_application'
    AND p1.`application_number` IS NULL
    AND existing.id IS NULL
) safe_candidates ON p.id = safe_candidates.id
SET p.application_number = safe_candidates.extracted_app;
