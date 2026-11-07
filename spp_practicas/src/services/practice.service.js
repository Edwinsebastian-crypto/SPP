'use strict';
const HttpError = require('../utils/http-error');
const { ROLES, USER_STATUS, AUDIT_ENTITIES, AUDIT_ACTIONS, PRACTICE_STATUS } = require('../config/constants');

/** Practice lifecycle: creation with its participants, updates, logbook (final grade), cancellation and deletion. */
class PracticeService {
  constructor({
    practiceRepository, activityRepository, userRepository, practiceTypeRepository, institutionRepository,
    practiceAccessService, auditService, notificationService, fileStorage, practiceLifecycleService
  }) {
    this.practiceRepository = practiceRepository;
    this.activityRepository = activityRepository;
    this.userRepository = userRepository;
    this.practiceTypeRepository = practiceTypeRepository;
    this.institutionRepository = institutionRepository;
    this.access = practiceAccessService;
    this.auditService = auditService;
    this.notificationService = notificationService;
    this.fileStorage = fileStorage;
    this.lifecycle = practiceLifecycleService;
  }

  /** Practices visible to the user, according to their role. */
  listFor(user) {
    const filters = {
      [ROLES.STUDENT]: { studentDocument: user.documentNumber },
      [ROLES.TUTOR]: { tutorDocument: user.documentNumber },
      [ROLES.ADVISOR]: { advisorDocument: user.documentNumber },
      [ROLES.DIRECTOR]: {}
    }[user.role];
    return this.practiceRepository.list(filters);
  }

  get(user, practiceId) {
    return this.access.loadAuthorized(user, practiceId);
  }

  async listActivities(user, practiceId) {
    const practice = await this.access.loadAuthorized(user, practiceId);
    return this.activityRepository.listByPractice(practice.id);
  }

  async createActivity(user, practiceId, data = {}, files = []) {
    const practice = await this.access.loadAuthorized(user, practiceId);
    this.lifecycle.assertWritable(practice);
    const activity = await this.activityRepository.create(practice.id, data);
    
    if (files && files.length > 0) {
      const { generateId } = require('../utils/id-generator');
      const uploadedFiles = await Promise.all(files.map(async (file) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255);
        const uploaded = await this.fileStorage.upload(file.buffer, { folder: `practice-activities/${practice.id}` });
        return { id: generateId('AR'), url: uploaded.secure_url, name: originalName, mimeType: file.mimetype };
      }));
      await this.activityRepository.addFiles(activity.id, uploadedFiles);
    }
    
    return activity;
  }

  async updateActivity(user, practiceId, activityId, data, files) {
    const practice = await this.access.loadAuthorized(user, practiceId);
    this.lifecycle.assertWritable(practice);
    const previousGrade = data.grade !== undefined ? Number((await this.activityRepository.findById(activityId))?.grade) || 0 : 0;

    // Process file deletions if keptFileIds is provided (usually when editing via modal)
    if (data.keptFileIds) {
      const keptIds = typeof data.keptFileIds === 'string' ? JSON.parse(data.keptFileIds) : data.keptFileIds;
      // activityRepository.findById only returns title, we need files: use listActivities to find current one
      const allActivities = await this.activityRepository.listByPractice(practice.id);
      const currentActivity = allActivities.find(a => String(a.id) === String(activityId));
      if (currentActivity && currentActivity.files) {
        const filesToDelete = currentActivity.files.filter(f => !keptIds.includes(f.id));
        for (const f of filesToDelete) {
          await this.activityRepository.deleteFile(f.id);
          const stored = this.fileStorage.parseUrl(f.url);
          if (stored) {
            await this.fileStorage.destroy(stored.publicId, stored.resourceType).catch(() => {});
          }
        }
      }
    }

    // Process new files
    if (files && files.length > 0) {
      const { generateId } = require('../utils/id-generator');
      const uploadedFiles = await Promise.all(files.map(async (file) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255);
        const uploaded = await this.fileStorage.upload(file.buffer, { folder: `practice-activities/${practice.id}` });
        return { id: generateId('AR'), url: uploaded.secure_url, name: originalName, mimeType: file.mimetype };
      }));
      await this.activityRepository.addFiles(activityId, uploadedFiles);
    }

    await this.activityRepository.update(activityId, data);
    // a new grade (> 0 and different from the stored one) -> the student is told
    const newGrade = Number(data.grade);
    if (data.grade !== undefined && newGrade > 0 && newGrade !== previousGrade && this.notificationService) {
      this.notificationService.activityGraded({ activityId, grader: user });
    }
    return this.activityRepository.findById(activityId);
  }

  async removeActivity(user, practiceId, activityId) {
    const practice = await this.access.loadAuthorized(user, practiceId);
    this.lifecycle.assertWritable(practice);
    
    const allActivities = await this.activityRepository.listByPractice(practice.id);
    const activity = allActivities.find(a => String(a.id) === String(activityId));
    if (!activity) throw HttpError.notFound('Activity not found');

    if (activity.evidenceCount > 0) {
      throw HttpError.badRequest('Cannot delete an activity that already has evidence.');
    }

    if (activity.files && activity.files.length > 0) {
      for (const f of activity.files) {
        await this.activityRepository.deleteFile(f.id);
        const stored = this.fileStorage.parseUrl(f.url);
        if (stored) {
          await this.fileStorage.destroy(stored.publicId, stored.resourceType).catch(() => {});
        }
      }
    }
    
    await this.activityRepository.deleteActivity(activityId);
    this.auditService.record(user, { entity: 'activity', entityId: activityId, practiceId: practice.id, action: AUDIT_ACTIONS.DELETE });
  }

  /** Verifies that the referenced catalog entries exist and that the participants have the right role and are active. */
  async #validateReferences(input) {
    const type = await this.practiceTypeRepository.findById(input.typeId);
    if (!type) throw HttpError.badRequest('The practice type does not exist');
    if (!(await this.institutionRepository.findById(input.institutionId))) throw HttpError.badRequest('The institution does not exist');

    const [student, tutor, advisor] = await Promise.all([
      this.userRepository.findByDocument(input.studentDocument),
      this.userRepository.findByDocument(input.tutorDocument),
      this.userRepository.findByDocument(input.advisorDocument)
    ]);
    const isValid = (user, role) => user && user.role === role && user.status === USER_STATUS.ACTIVE;
    if (!isValid(student, ROLES.STUDENT)) throw HttpError.badRequest('The selected student is not valid or is not active');
    if (!isValid(tutor, ROLES.TUTOR)) throw HttpError.badRequest('The selected tutor is not valid or is not active');
    if (!isValid(advisor, ROLES.ADVISOR)) throw HttpError.badRequest('The selected advisor is not valid or is not active');
    return { type, student, tutor, advisor };
  }

  /** @param {object} input validated by parsePracticeInput */
  async create(actor, input) {
    const { type, student, tutor, advisor } = await this.#validateReferences(input);
    const id = await this.practiceRepository.create(input);
    this.auditService.record(actor, { entity: AUDIT_ENTITIES.PRACTICE, entityId: id, practiceId: id, action: AUDIT_ACTIONS.INSERT });

    this.notificationService.notifyPracticeAssigned({
      practiceId: id,
      practiceName: type.name,
      startDate: input.startDate,
      endDate: input.endDate,
      participants: [
        { person: student, roleLabel: 'student' },
        { person: tutor, roleLabel: 'academic tutor' },
        { person: advisor, roleLabel: 'pedagogical advisor' }
      ]
    });
    return this.practiceRepository.findById(id);
  }

  async update(actor, id, input) {
    const existing = await this.practiceRepository.findById(id);
    if (!existing) throw HttpError.notFound('Practice not found');
    // a cancelled practice is read-only; a completed one only accepts the edit that reopens it (end date)
    if (existing.status === PRACTICE_STATUS.CANCELLED) this.lifecycle.assertWritable(existing);
    await this.#validateReferences(input);
    // the status is never taken from the form: it follows the lifecycle (a completed practice whose end date changes goes back to grading)
    const status = this.lifecycle.statusAfterEdit(existing, input);
    if (existing.status === PRACTICE_STATUS.COMPLETED && status === PRACTICE_STATUS.COMPLETED) {
      throw HttpError.conflict('The practice is completed and can only be viewed (change the end date to reopen it for grading)');
    }
    await this.practiceRepository.update(id, { ...input, status });
    this.auditService.record(actor, { entity: AUDIT_ENTITIES.PRACTICE, entityId: id, practiceId: id, action: AUDIT_ACTIONS.UPDATE });
    return this.practiceRepository.findById(id);
  }

  /** The Director cancels the practice: from then on it can only be viewed. */
  async cancel(actor, id) {
    const practice = await this.practiceRepository.findById(id);
    if (!practice) throw HttpError.notFound('Practice not found');
    if (practice.status === PRACTICE_STATUS.CANCELLED) throw HttpError.conflict('The practice is already cancelled');
    if (practice.status === PRACTICE_STATUS.COMPLETED) throw HttpError.conflict('A completed practice cannot be cancelled');
    await this.practiceRepository.setStatus(id, PRACTICE_STATUS.CANCELLED);
    this.auditService.record(actor, { entity: AUDIT_ENTITIES.PRACTICE, entityId: id, practiceId: id, action: AUDIT_ACTIONS.UPDATE });
    return this.practiceRepository.findById(id);
  }

  async remove(actor, id) {
    if (!(await this.practiceRepository.findById(id))) throw HttpError.notFound('Practice not found');
    await this.practiceRepository.delete(id);
    this.auditService.record(actor, { entity: AUDIT_ENTITIES.PRACTICE, entityId: id, practiceId: id, action: AUDIT_ACTIONS.DELETE });
  }

  /** The assigned tutor (or the director) records the final grade and a general observation. */
  async updateLogbook(actor, practiceId, input) {
    const practice = await this.access.loadAuthorized(actor, practiceId);
    this.lifecycle.assertCanGrade(practice);
    await this.practiceRepository.updateLogbook(practice.id, input);
    const status = await this.lifecycle.afterLogbook(practice, input);
    this.auditService.record(actor, { entity: AUDIT_ENTITIES.LOGBOOK, entityId: practice.id, practiceId: practice.id, action: AUDIT_ACTIONS.UPDATE });
    // a new final grade (> 0 and different from the stored one) -> the student is told ("0" means not graded)
    if (status === PRACTICE_STATUS.COMPLETED && input.finalGrade > 0 && Number(input.finalGrade) !== Number(practice.finalGrade) && this.notificationService) {
      this.notificationService.practiceGraded({ practiceId: practice.id });
    }
    return this.practiceRepository.findById(practice.id);
  }
}

module.exports = PracticeService;
