'use strict';
const HttpError = require('../utils/http-error');

class InternalController {
  /** @param {{repository: object, notificationRepository?: object}} deps */
  constructor({ repository, notificationRepository = null }) {
    this.repo = repository;
    this.notificationRepo = notificationRepository;
  }

  listEvidences = async (req, res) => {
    const list = await this.repo.listByPractice(req.params.practiceId);
    res.json(list);
  };

  getEvidence = async (req, res) => {
    const ev = await this.repo.getEvidenceById(req.params.evidenceId);
    if (!ev) throw HttpError.notFound('Evidence not found');
    res.json(ev);
  };

  getActivity = async (req, res) => {
    const act = await this.repo.getActivityById(req.params.activityId);
    if (!act) throw HttpError.notFound('Activity not found');
    res.json(act);
  };

  downloadEvidenceFile = async (req, res) => {
    const file = await this.repo.getEvidenceFileById(req.params.fileId);
    if (!file || !file.url) throw HttpError.notFound('File not found');
    await this.#pipeFile(file, res);
  };

  downloadActivityFile = async (req, res) => {
    const file = await this.repo.getActivityFileById(req.params.fileId);
    if (!file || !file.url) throw HttpError.notFound('File not found');
    await this.#pipeFile(file, res);
  };

  verifyBelongs = async (req, res) => {
    const { tipo, id, id_practica } = req.query;
    if (!tipo || !id || !id_practica) {
      return res.json({ pertenece: false });
    }
    const pertenece = await this.repo.belongsToPractice(String(tipo), String(id), String(id_practica));
    res.json({ pertenece });
  };

  // --- machine-to-machine for servicio_notificaciones ---
  getPerson = async (req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    const p = await this.notificationRepo.findPerson(req.params.role, req.params.documentNumber);
    res.json(p);
  };

  listActiveDirectors = async (_req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    res.json(await this.notificationRepo.listActiveDirectors());
  };

  getPractice = async (req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    const p = await this.notificationRepo.findPractice(req.params.practiceId);
    res.json(p);
  };

  getActivityNotification = async (req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    const act = await this.notificationRepo.findActivity(req.params.activityId);
    res.json(act);
  };

  listActivitiesDueSoon = async (req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    const hours = Number(req.query.hours) || 24;
    const tz = req.query.tz || 'America/Bogota';
    res.json(await this.notificationRepo.listActivitiesDueSoon(hours, tz));
  };

  listActivitiesAwaitingReview = async (_req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    res.json(await this.notificationRepo.listActivitiesAwaitingReview());
  };

  listUngradedPractices = async (req, res) => {
    if (!this.notificationRepo) throw HttpError.notFound('Notification repository not available');
    const tz = req.query.tz || 'America/Bogota';
    res.json(await this.notificationRepo.listUngradedPractices(tz));
  };

  async #pipeFile(file, res) {
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw HttpError.badGateway('Failed to fetch file from remote storage');
      const mime = file.mime || response.headers.get('content-type') || 'application/octet-stream';
      const filename = file.name || 'archivo';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw HttpError.badGateway(`Could not download file: ${err.message}`);
    }
  }
}

module.exports = InternalController;

