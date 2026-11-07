'use strict';
const HttpError = require('../utils/http-error');
const { generateId } = require('../utils/id-generator');
const { AUDIT_ENTITIES, AUDIT_ACTIONS, ROLES } = require('../config/constants');

/**
 * Evidence: the file goes to Cloudinary; PostgreSQL stores the evidence (description + hours worked)
 * and its file (URL, name and MIME type).
 */
class EvidenceService {
  constructor({ evidenceRepository, practiceAccessService, fileStorage, auditService, practiceLifecycleService }) {
    this.evidenceRepository = evidenceRepository;
    this.access = practiceAccessService;
    this.fileStorage = fileStorage;
    this.auditService = auditService;
    this.lifecycle = practiceLifecycleService;
  }

  #assertActivityNotClosed(activity) {
    if (!activity) return;
    if (activity.dueDate) {
      const str = typeof activity.dueDate === 'string' ? activity.dueDate.replace(/T/, ' ').replace(/Z$|[+-][0-9:]+$/, '').trim() : '';
      const due = str ? new Date(str.replace(' ', 'T')) : new Date(activity.dueDate);
      if (!isNaN(due.getTime()) && Date.now() >= due.getTime()) {
        throw HttpError.badRequest('Activity deadline has passed; submissions are closed');
      }
    }
    if (activity.grade !== null && activity.grade !== undefined && activity.grade !== '' && Number(activity.grade) > 0) {
      throw HttpError.badRequest('Activity has already been graded; modifications are not allowed');
    }
  }

  async listByActivity(user, activityId) {
    const { activity } = await this.access.loadAuthorizedActivity(user, activityId);
    return this.evidenceRepository.listByActivity(activity.id);
  }

  /** @param {{files: object[], links: object[], description: string, hours: number}} input */
  async upload(user, activityId, { files, links = [], description, hours }) {
    const { activity, practice } = await this.access.loadAuthorizedActivity(user, activityId);
    this.lifecycle.assertWritable(practice);
    if (user.role === ROLES.STUDENT) {
      this.#assertActivityNotClosed(activity);
    }
    if ((!files || !files.length) && !links.length) throw HttpError.badRequest('Attach a file or a Google Drive link');

    const uploadedFiles = await Promise.all((files || []).map(async (file) => {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255);
      const uploaded = await this.fileStorage.upload(file.buffer, { folder: `practice-evidence/${practice.id}` });
      return { id: generateId('AR'), url: uploaded.secure_url, name: originalName, mimeType: file.mimetype, public_id: uploaded.public_id, resource_type: uploaded.resource_type };
    }));
    const linkedFiles = links.map((link) => ({ id: generateId('AR'), ...link })); // nothing to upload: only the URL is stored
    const allFiles = [...uploadedFiles, ...linkedFiles];

    const id = generateId('EV');
    try {
      await this.evidenceRepository.create({
        id, description, hours, activityId: activity.id,
        files: allFiles
      });
    } catch (err) {
      await Promise.all(uploadedFiles.map(f => this.fileStorage.destroy(f.public_id, f.resource_type).catch(() => {})));
      throw err;
    }
    const created = await this.evidenceRepository.findById(id);
    this.auditService.record(user, {
      entity: AUDIT_ENTITIES.EVIDENCE,
      entityId: id,
      practiceId: practice.id,
      action: AUDIT_ACTIONS.INSERT,
      after: created || { id, description, hours, activityId: activity.id, files: allFiles },
      details: `Evidencia ${id} registrada con ${hours} horas para actividad ${activity.id}`
    });
    await this.lifecycle.syncHours(practice.id);
    return created || this.evidenceRepository.findById(id);
  }

  async #loadAuthorized(user, evidenceId) {
    const evidence = await this.evidenceRepository.findById(evidenceId);
    if (!evidence) throw HttpError.notFound('Evidence not found');
    const practice = await this.access.loadAuthorized(user, evidence.practiceId);
    return { evidence, practice };
  }

  async update(user, evidenceId, { description, hours, newFiles, newLinks = [], keptFileIds }) {
    const { evidence, practice } = await this.#loadAuthorized(user, evidenceId);
    this.lifecycle.assertWritable(practice);
    if (user.role === ROLES.STUDENT) {
      this.#assertActivityNotClosed(evidence);
    }
    
    const existingFiles = evidence.files || [];
    const filesToDelete = existingFiles.filter(f => !keptFileIds.includes(f.id));
    for (const f of filesToDelete) {
      await this.evidenceRepository.deleteFile(f.id);
      const stored = this.fileStorage.parseUrl(f.url);
      if (stored) {
        await this.fileStorage.destroy(stored.publicId, stored.resourceType).catch(() => {});
      }
    }

    if (newFiles && newFiles.length > 0) {
      const uploadedFiles = await Promise.all(newFiles.map(async (file) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255);
        const uploaded = await this.fileStorage.upload(file.buffer, { folder: `practice-evidence/${practice.id}` });
        return { id: generateId('AR'), url: uploaded.secure_url, name: originalName, mimeType: file.mimetype, public_id: uploaded.public_id, resource_type: uploaded.resource_type };
      }));
      await this.evidenceRepository.addFiles(evidence.id, uploadedFiles);
    }

    if (newLinks.length) {
      await this.evidenceRepository.addFiles(evidence.id, newLinks.map((link) => ({ id: generateId('AR'), ...link })));
    }

    await this.evidenceRepository.update(evidence.id, description, hours);
    const updated = await this.evidenceRepository.findById(evidence.id);
    this.auditService.record(user, {
      entity: AUDIT_ENTITIES.EVIDENCE,
      entityId: evidence.id,
      practiceId: practice.id,
      action: AUDIT_ACTIONS.UPDATE,
      before: evidence,
      after: updated,
      details: `Evidencia ${evidence.id} actualizada`
    });
    await this.lifecycle.syncHours(practice.id);
    return updated;
  }

  async remove(user, evidenceId) {
    const { evidence, practice } = await this.#loadAuthorized(user, evidenceId);
    this.lifecycle.assertWritable(practice);
    if (user.role === ROLES.STUDENT) {
      this.#assertActivityNotClosed(evidence);
    }
    await this.evidenceRepository.delete(evidence.id);
    const files = evidence.files || [];
    for (const file of files) {
      const stored = this.fileStorage.parseUrl(file.url);
      if (stored) {
        await this.fileStorage.destroy(stored.publicId, stored.resourceType)
          .catch((err) => console.warn('[cloudinary] destroy:', err.message));
      }
    }
    this.auditService.record(user, {
      entity: AUDIT_ENTITIES.EVIDENCE,
      entityId: evidence.id,
      practiceId: practice.id,
      action: AUDIT_ACTIONS.DELETE,
      before: evidence,
      details: `Evidencia ${evidence.id} eliminada (${evidence.hours} horas)`
    });
    await this.lifecycle.syncHours(practice.id);
  }
}

module.exports = EvidenceService;
