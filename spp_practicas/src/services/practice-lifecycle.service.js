'use strict';
const HttpError = require('../utils/http-error');
const { PRACTICE_STATUS, READ_ONLY_PRACTICE_STATUSES } = require('../config/constants');

/** 'YYYY-MM-DD' of a date that may arrive as a string or as a Date. */
function isoDay(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toLocaleDateString('en-CA');
  return String(value).slice(0, 10);
}

/**
 * Practice lifecycle (single source of truth for the state machine):
 *
 *   active ──(all required hours logged)──▶ evaluating ──(tutor closes the evaluation / records grades)──▶ grading
 *   evaluating | grading ──(final grade + observation recorded)──▶ completed        (read-only for every role)
 *   completed ──(end date edited)──▶ grading                                         (the tutor may adjust grades again)
 *   active | evaluating | grading ──(director cancels)──▶ cancelled                  (read-only for every role)
 *
 * Editing the end date in any other state does not change the status.
 */
class PracticeLifecycleService {
  constructor({ practiceRepository, notificationService = null }) {
    this.practiceRepository = practiceRepository;
    this.notificationService = notificationService;
  }

  static isReadOnly(practice) {
    return Boolean(practice) && READ_ONLY_PRACTICE_STATUSES.includes(practice.status);
  }

  /** Throws 409 when the practice is finished or cancelled (nobody may modify it). */
  assertWritable(practice) {
    if (!PracticeLifecycleService.isReadOnly(practice)) return;
    throw HttpError.conflict(practice.status === PRACTICE_STATUS.CANCELLED
      ? 'The practice is cancelled and can only be viewed'
      : 'The practice is completed and can only be viewed');
  }

  /**
   * active <-> evaluating according to the hours logged. Called after every change of evidence.
   * Reaching every required hour tells the tutor that it is time to evaluate.
   */
  async syncHours(practiceId) {
    const practice = await this.practiceRepository.findById(practiceId);
    if (!practice) return null;
    if (practice.status !== PRACTICE_STATUS.ACTIVE && practice.status !== PRACTICE_STATUS.EVALUATING) return practice.status;

    const required = Number(practice.requiredHours) || 0;
    if (required <= 0) return practice.status;
    const total = await this.practiceRepository.totalHours(practice.id);

    if (practice.status === PRACTICE_STATUS.ACTIVE && total >= required) {
      await this.practiceRepository.setStatus(practice.id, PRACTICE_STATUS.EVALUATING);
      if (this.notificationService) this.notificationService.practiceReadyToEvaluate({ practiceId: practice.id });
      return PRACTICE_STATUS.EVALUATING;
    }
    if (practice.status === PRACTICE_STATUS.EVALUATING && total < required) {
      await this.practiceRepository.setStatus(practice.id, PRACTICE_STATUS.ACTIVE); // an evidence was removed / reduced
      return PRACTICE_STATUS.ACTIVE;
    }
    return practice.status;
  }

  /** The tutor closed an evaluation: evaluating -> grading. */
  async evaluationClosed(practiceId) {
    if (!practiceId) return null;
    const practice = await this.practiceRepository.findById(practiceId);
    if (!practice || practice.status !== PRACTICE_STATUS.EVALUATING) return practice ? practice.status : null;
    await this.practiceRepository.setStatus(practice.id, PRACTICE_STATUS.GRADING);
    return PRACTICE_STATUS.GRADING;
  }

  /** Only a practice that is being evaluated / graded accepts the final grade. */
  assertCanGrade(practice) {
    this.assertWritable(practice);
    if (practice.status !== PRACTICE_STATUS.EVALUATING && practice.status !== PRACTICE_STATUS.GRADING) {
      throw HttpError.conflict('The final grade can be recorded once the student completes all the hours (status Evaluando or Calificando)');
    }
  }

  /**
   * Status after the logbook was saved: with a final grade AND an observation the practice is completed; otherwise an
   * evaluating practice moves on to grading.
   */
  async afterLogbook(practice, { finalGrade, generalObservation }) {
    const fresh = await this.practiceRepository.findById(practice.id);
    const grade = Number(fresh.finalGrade) || 0;
    const observation = String(fresh.finalObservation || '').trim();
    let next = fresh.status;
    if (grade > 0 && observation) next = PRACTICE_STATUS.COMPLETED;
    else if (fresh.status === PRACTICE_STATUS.EVALUATING && (finalGrade != null || generalObservation)) next = PRACTICE_STATUS.GRADING;
    if (next !== fresh.status) await this.practiceRepository.setStatus(fresh.id, next);
    return next;
  }

  /** Status that a director edit must persist (the form never changes the status by itself). */
  statusAfterEdit(existing, input) {
    if (existing.status === PRACTICE_STATUS.COMPLETED && isoDay(existing.endDate) !== isoDay(input.endDate)) {
      return PRACTICE_STATUS.GRADING;
    }
    return existing.status;
  }
}

module.exports = PracticeLifecycleService;
