'use strict';
const express = require('express');
const { q } = require('../db');
const { ah, ok } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', ah(async (req, res) => {
  const count = (sql, ...p) => q.get(sql, ...p).c;
  const summary = {
    total_documents: count(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL`),
    incoming: count(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL AND direction='incoming'`),
    outgoing: count(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL AND direction='outgoing' AND id IN (SELECT document_id FROM transmittal_items)`),
    pending_review: count(`SELECT COUNT(*) c FROM documents d JOIN statuses s ON s.id=d.internal_status_id WHERE s.code='URV' AND d.deleted_at IS NULL`),
    pending_endorsement: count(`SELECT COUNT(*) c FROM documents d JOIN statuses s ON s.id=d.internal_status_id WHERE s.code='PEND' AND d.deleted_at IS NULL`),
    pending_approval: count(`SELECT COUNT(*) c FROM documents d JOIN statuses s ON s.id=d.internal_status_id WHERE s.code IN ('PAP','END') AND d.deleted_at IS NULL`),
    approved: count(`SELECT COUNT(*) c FROM documents d JOIN statuses s ON s.id=d.internal_status_id WHERE s.code='APP' AND d.deleted_at IS NULL`),
    rejected: count(`SELECT COUNT(*) c FROM documents d JOIN statuses s ON s.id=d.internal_status_id WHERE s.code='REJ' AND d.deleted_at IS NULL`),
    referred_to_contractor: count(`SELECT COUNT(*) c FROM documents d JOIN statuses s ON s.id=d.external_status_id WHERE s.name LIKE '%Referred%' AND d.deleted_at IS NULL`),
    overdue_reviews: count(`SELECT COUNT(*) c FROM reviews WHERE status IN ('pending','in_progress') AND review_due_date < date('now')`),
    overdue_approvals: count(`SELECT COUNT(*) c FROM approvals WHERE status='in_progress' AND deadline_at IS NOT NULL AND deadline_at < datetime('now')`),
    open_resolutions: count(`SELECT COUNT(*) c FROM resolutions WHERE status IN ('open','in_progress','escalated')`),
    escalated: count(`SELECT COUNT(*) c FROM resolutions WHERE status='escalated'`),
    transmittals_awaiting_ack: count(`SELECT COUNT(*) c FROM transmittals WHERE status='issued'`)
  };
  ok(res, { counters: summary, my_tasks: {
    reviews: count(`SELECT COUNT(*) c FROM reviews WHERE reviewer_user_id=? AND status IN ('pending','in_progress')`, req.user.id),
    endorsements: count(`SELECT COUNT(*) c FROM endorsements WHERE endorser_user_id=? AND status='pending'`, req.user.id),
    approvals: count(`SELECT COUNT(*) c FROM approval_steps st JOIN approvals a ON a.id=st.approval_id WHERE st.approver_user_id=? AND st.status='pending' AND a.status='in_progress'`, req.user.id),
    resolutions: count(`SELECT COUNT(*) c FROM resolutions WHERE responsible_user_id=? AND status IN ('open','in_progress','escalated')`, req.user.id)
  }});
}));

router.get('/charts', ah(async (req, res) => {
  const statusDist = q.all(
    `SELECT s.name AS label, s.color, COUNT(d.id) AS value
     FROM statuses s LEFT JOIN documents d ON d.internal_status_id=s.id AND d.deleted_at IS NULL
     WHERE s.scope IN ('internal','both')
     GROUP BY s.id HAVING value > 0 ORDER BY value DESC LIMIT 10`);
  const volumeTrend = q.all(
    `SELECT strftime('%Y-%m', registered_at) AS label, COUNT(*) AS value
     FROM documents WHERE registered_at IS NOT NULL AND deleted_at IS NULL
     GROUP BY label ORDER BY label DESC LIMIT 12`);
  volumeTrend.reverse();
  const byDiscipline = q.all(
    `SELECT COALESCE(di.code,'-') AS label, COUNT(d.id) AS value FROM documents d
     LEFT JOIN disciplines di ON di.id=d.discipline_id WHERE d.deleted_at IS NULL
     GROUP BY di.id ORDER BY value DESC LIMIT 8`);
  const contractorSubs = q.all(
    `SELECT o.name AS label, COUNT(d.id) AS value FROM documents d
     JOIN organizations o ON o.id=d.originator_org_id
     WHERE d.direction='incoming' AND d.deleted_at IS NULL
     GROUP BY o.id ORDER BY value DESC LIMIT 8`);
  // review SLA performance: avg days to complete
  const sla = q.get(
    `SELECT ROUND(AVG(julianday(completed_at)-julianday(assigned_at)),1) avg_days,
            SUM(CASE WHEN completed_at <= assigned_at THEN 0 ELSE 0 END) x
     FROM reviews WHERE completed_at IS NOT NULL`);
  // Operational metrics
  const activeWorkflows = q.get(`SELECT COUNT(*) c FROM workflow_instances WHERE status='running'`).c;
  const completedThisMonth = q.get(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL AND registered_at >= date('now','start of month')`).c;
  const avgDaysToApprove = q.get(
    `SELECT ROUND(AVG(julianday(r.approval_date)-julianday(d.registered_at)),1) avg
     FROM document_revisions r JOIN documents d ON d.id=r.document_id
     JOIN statuses s ON s.id=r.status_id
     WHERE r.approval_date IS NOT NULL AND s.code='APP'`).avg || 0;
  const archiveRate = q.get(`SELECT COUNT(*) c FROM documents WHERE archive_status='archived'`).c;
  const totalDocs = q.get(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL`).c;
  const overdueActions = q.get(`SELECT COUNT(*) c FROM (
    SELECT id FROM reviews WHERE status IN ('pending','in_progress') AND review_due_date < date('now')
    UNION ALL
    SELECT id FROM approvals WHERE status='in_progress' AND deadline_at IS NOT NULL AND deadline_at < datetime('now')
    UNION ALL
    SELECT id FROM resolutions WHERE status IN ('open','in_progress','escalated')
  )`).c;
  const missingClassification = q.get(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL AND (discipline_id IS NULL OR category_id IS NULL)`).c;
  const pendingDistribution = q.get(`SELECT COUNT(*) c FROM transmittals WHERE status IN ('issued','acknowledged')`).c;
  const activeProjects = q.get(`SELECT COUNT(*) c FROM projects WHERE is_active=1`).c;
  const docsPerProject = totalDocs > 0 && activeProjects > 0 ? Math.round(totalDocs / activeProjects) : 0;
  const openCorrespondence = q.get(`SELECT COUNT(*) c FROM correspondence WHERE status IN ('new','in_progress','awaiting_response')`).c;
  const pendingTransmittals = q.get(`SELECT COUNT(*) c FROM transmittals WHERE status IN ('draft','issued')`).c;
  const complianceScore = totalDocs > 0 ? Math.round(((totalDocs - missingClassification) / totalDocs) * 100) : 100;

  ok(res, {
    status_distribution: statusDist, volume_trend: volumeTrend,
    by_discipline: byDiscipline, contractor_submissions: contractorSubs,
    review_sla_avg_days: sla.avg_days || 0,
    active_workflows: activeWorkflows,
    completed_this_month: completedThisMonth,
    avg_days_to_approve: avgDaysToApprove,
    archive_rate: totalDocs > 0 ? Math.round((archiveRate / totalDocs) * 100) : 0,
    overdue_actions: overdueActions,
    missing_classification: missingClassification,
    pending_distribution: pendingDistribution,
    compliance_score: complianceScore,
    active_projects: activeProjects,
    docs_per_project: docsPerProject,
    open_correspondence: openCorrespondence,
    pending_transmittals: pendingTransmittals
  });
}));

module.exports = router;
