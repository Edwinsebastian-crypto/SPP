import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CustomDateTimePicker from '../common/CustomDateTimePicker';

const GOOGLE_HOSTS = {
    'drive.google.com': 'Google Drive',
    'docs.google.com': 'Google Docs',
    'sheets.google.com': 'Google Sheets',
    'slides.google.com': 'Google Slides',
    'forms.google.com': 'Google Forms',
};
const GOOGLE_LINK_MIME = 'application/vnd.google-apps.link';

export const isLinkFile = (f) =>
    Boolean(f && (f.isLink || f.mimeType === GOOGLE_LINK_MIME));

export const fileIcon = (f) =>
    isLinkFile(f) ? 'fa-brands fa-google-drive' : 'fa-solid fa-paperclip';

export function parseGoogleLink(raw) {
    let url;
    try {
        url = new URL(String(raw || '').trim());
    } catch (err) {
        throw new Error('That is not a valid link.');
    }
    if (url.protocol !== 'https:' || !GOOGLE_HOSTS[url.hostname]) {
        throw new Error(
            'Only links to Google Drive, Docs, Sheets, Slides or Forms are allowed.'
        );
    }
    let label = GOOGLE_HOSTS[url.hostname];
    if (url.hostname === 'docs.google.com') {
        if (url.pathname.startsWith('/spreadsheets')) label = 'Google Sheets';
        else if (url.pathname.startsWith('/presentation'))
            label = 'Google Slides';
        else if (url.pathname.startsWith('/forms')) label = 'Google Forms';
    }
    return { url: url.toString(), name: `${label} link`, isLink: true };
}

export function descargarArchivo(urlOriginal, nombreDescarga = 'evidencia') {
    if (!urlOriginal || !urlOriginal.includes('/upload/')) {
        return window.open(urlOriginal, '_blank');
    }
    const nombreSinExtension = nombreDescarga.replace(/\.[^/.]+$/, '');
    const nombreLimpio = nombreSinExtension
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

    const urlDescarga = urlOriginal.replace(
        '/upload/',
        `/upload/fl_attachment:${nombreLimpio}/`
    );
    const enlaceTemporal = document.createElement('a');
    enlaceTemporal.href = urlDescarga;
    enlaceTemporal.setAttribute('download', nombreDescarga);
    document.body.appendChild(enlaceTemporal);
    enlaceTemporal.click();
    document.body.removeChild(enlaceTemporal);
}

export function formatForDateTimeLocal(dateVal) {
    if (!dateVal) return '';
    const str =
        typeof dateVal === 'string'
            ? dateVal
                  .replace(/T/, ' ')
                  .replace(/Z$|[+-][0-9:]+$/, '')
                  .trim()
            : '';
    const d = str ? new Date(str.replace(' ', 'T')) : new Date(dateVal);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Student Evidence Modal (Add New Evidence / Upload Evidence / Edit Evidence / View Evidence)
 */
export function StudentEvidenceModal({
    open,
    mode = 'add', // 'add' | 'add-activity' | 'edit' | 'view'
    evidence = null,
    busy = false,
    onClose,
    onSubmit,
}) {
    const [hours, setHours] = useState('1');
    const [description, setDescription] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [linkValue, setLinkValue] = useState('');
    const [linkError, setLinkError] = useState('');
    const [hoursError, setHoursError] = useState(false);
    const [dropzoneError, setDropzoneError] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef(null);
    const hoursInputRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        setLinkValue('');
        setLinkError('');
        setHoursError(false);
        setDropzoneError(false);

        if (mode === 'edit' && evidence) {
            setHours(evidence.hours != null ? String(evidence.hours) : '');
            setDescription(evidence.description || '');
            setSelectedFiles(
                (evidence.files || []).map((f) => ({ ...f, isExisting: true }))
            );
        } else if (mode === 'view' && evidence) {
            setHours(evidence.hours != null ? String(evidence.hours) : '');
            setDescription(evidence.description || 'No description provided');
            setSelectedFiles(
                (evidence.files || []).map((f) => ({ ...f, isExisting: true }))
            );
        } else {
            setHours('1');
            setDescription('');
            setSelectedFiles([]);
        }

        document.body.style.overflow = 'hidden';
        if (mode !== 'view') {
            setTimeout(() => hoursInputRef.current?.focus(), 50);
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open, mode, evidence]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, busy, onClose]);

    if (!open) return null;

    const isView = mode === 'view';
    const title =
        mode === 'view'
            ? 'View Evidence'
            : mode === 'edit'
            ? 'Edit Evidence'
            : mode === 'add-activity'
            ? 'Upload Evidence'
            : 'Add New Evidence';

    const handleAddFiles = (fileList) => {
        if (!fileList || !fileList.length) return;
        const arr = Array.from(fileList);
        setSelectedFiles((prev) => [...prev, ...arr]);
    };

    const handleAddLink = () => {
        setLinkError('');
        if (!linkValue.trim()) return;
        try {
            const link = parseGoogleLink(linkValue);
            if (selectedFiles.some((f) => f.url === link.url)) {
                throw new Error('That link is already attached.');
            }
            setSelectedFiles((prev) => [...prev, link]);
            setLinkValue('');
        } catch (err) {
            setLinkError(err.message);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (busy || isView) return;

        const numHours = Number(hours);
        if (
            hours === '' ||
            !Number.isInteger(numHours) ||
            numHours < 0 ||
            numHours > 1000
        ) {
            setHoursError(true);
            setTimeout(() => setHoursError(false), 1200);
            hoursInputRef.current?.focus();
            return;
        }

        const newFiles = selectedFiles.filter(
            (f) => !f.isExisting && !f.isLink
        );
        const newLinks = selectedFiles.filter((f) => !f.isExisting && f.isLink);
        const keptFileIds = selectedFiles
            .filter((f) => f.isExisting)
            .map((f) => f.id);

        if (!newFiles.length && !newLinks.length && !keptFileIds.length) {
            setDropzoneError(true);
            setTimeout(() => setDropzoneError(false), 1200);
            return;
        }

        onSubmit({
            mode,
            id: evidence?.id || null,
            newFiles,
            newLinks,
            keptFileIds,
            hours: numHours,
            description,
        });
    };

    return createPortal(
        <div
            id="am-modal"
            className="am-modal-overlay"
            style={{ display: 'flex' }}
        >
            <div
                className="am-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="am-modal-title"
            >
                <button
                    type="button"
                    className="am-modal-close"
                    id="amModalCloseX"
                    aria-label="Close"
                    onClick={() => !busy && onClose()}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
                <h3 className="am-modal-title" id="am-modal-title">
                    {title}
                </h3>

                <form
                    id="am-form"
                    className="am-form"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <div className="am-field">
                        <label htmlFor="am-hours">Hours Worked</label>
                        <input
                            ref={hoursInputRef}
                            type="number"
                            id="am-hours"
                            name="hours"
                            className={`act-value-box act-input${
                                hoursError ? ' am-input-error' : ''
                            }`}
                            min="0"
                            max="1000"
                            step="1"
                            value={hours}
                            readOnly={isView}
                            placeholder="0"
                            onChange={(e) => setHours(e.target.value)}
                        />
                    </div>
                    <div className="am-field">
                        <label htmlFor="am-desc">Description</label>
                        <textarea
                            id="am-desc"
                            name="description"
                            rows="5"
                            maxLength={4000}
                            readOnly={isView}
                            placeholder="Write the description of the evidence (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div
                        className={`am-dropzone${
                            isDragOver ? ' is-dragover' : ''
                        }${dropzoneError ? ' am-input-error' : ''}`}
                        id="am-dropzone"
                        tabIndex={0}
                        role="button"
                        aria-label="Attach the evidence file"
                        style={
                            isView
                                ? {
                                      display: 'flex',
                                      border: 'none',
                                      background: 'transparent',
                                      padding: 0,
                                      margin: 0,
                                  }
                                : { display: 'flex' }
                        }
                        onClick={(e) => {
                            if (isView) return;
                            if (
                                e.target.closest('a') ||
                                e.target.closest('button')
                            )
                                return;
                            fileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                            if (isView) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }}
                        onDragEnter={(e) => {
                            if (isView) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(true);
                        }}
                        onDragOver={(e) => {
                            if (isView) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(true);
                        }}
                        onDragLeave={(e) => {
                            if (isView) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(false);
                        }}
                        onDrop={(e) => {
                            if (isView) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(false);
                            if (e.dataTransfer?.files) {
                                handleAddFiles(e.dataTransfer.files);
                            }
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="am-file-input"
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            multiple
                            hidden
                            onChange={(e) => {
                                handleAddFiles(e.target.files);
                                e.target.value = '';
                            }}
                        />
                        {!isView && (
                            <>
                                <i
                                    className="fa-solid fa-cloud-arrow-up"
                                    aria-hidden="true"
                                />
                                <strong>Attach Evidence File</strong>
                                <span>Drag a file here or click to upload</span>
                            </>
                        )}
                        <div
                            className={`am-file-list${
                                selectedFiles.length ? ' has-files' : ''
                            }`}
                            id="am-file-list"
                            style={
                                isView
                                    ? {
                                          width: '100%',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'flex-start',
                                      }
                                    : undefined
                            }
                        >
                            {isView && selectedFiles.length > 0 ? (
                                <label
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        display: 'block',
                                        fontFamily: "'Playfair Display', serif",
                                        fontWeight: 700,
                                        fontSize: '1.1rem',
                                        margin: '16px 0 8px 0',
                                    }}
                                >
                                    Files
                                </label>
                            ) : null}
                            {selectedFiles.map((f, i) => (
                                <span
                                    key={i}
                                    className="am-file-chip"
                                    style={
                                        isView
                                            ? {
                                                  marginBottom: '8px',
                                                  width: '100%',
                                                  padding: '12px 16px',
                                                  justifyContent: 'flex-start',
                                                  borderRadius: '24px',
                                              }
                                            : undefined
                                    }
                                >
                                    {isView && f.isExisting ? (
                                        <>
                                            <i
                                                className={fileIcon(f)}
                                                aria-hidden="true"
                                                style={{
                                                    marginRight: '12px',
                                                    fontSize: '1.1rem',
                                                    color: 'var(--clr-primary-dark, #103323)',
                                                }}
                                            />
                                            <a
                                                href={f.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="am-file-chip-name"
                                                style={{
                                                    textDecoration: 'none',
                                                    color: 'var(--clr-primary-dark, #103323)',
                                                    cursor: 'pointer',
                                                    flex: 1,
                                                    fontWeight: 600,
                                                    fontSize: '1rem',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                {f.name}
                                            </a>
                                            <button
                                                type="button"
                                                className="am-file-view am-file-download-btn"
                                                title="Download"
                                                style={{
                                                    color: 'var(--clr-primary-dark, #103323)',
                                                    marginLeft: '8px',
                                                    fontSize: '1.3rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    descargarArchivo(
                                                        f.url,
                                                        f.name
                                                    );
                                                }}
                                            >
                                                <i
                                                    className="fa-solid fa-download"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <i
                                                className={fileIcon(f)}
                                                aria-hidden="true"
                                            />
                                            <span className="am-file-chip-name">
                                                {f.name}
                                            </span>
                                            <button
                                                type="button"
                                                className="am-file-remove"
                                                aria-label={`Remove ${f.name}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFiles((prev) =>
                                                        prev.filter(
                                                            (_, idx) =>
                                                                idx !== i
                                                        )
                                                    );
                                                }}
                                            >
                                                <i
                                                    className="fa-solid fa-xmark"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>

                    {!isView && (
                        <div className="am-google" id="am-google">
                            <strong className="am-google-title">
                                <i
                                    className="fa-brands fa-google"
                                    aria-hidden="true"
                                />{' '}
                                Or use Google
                            </strong>
                            <div className="am-google-actions">
                                <a
                                    className="am-google-btn"
                                    href="https://drive.google.com/drive/my-drive"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <i
                                        className="fa-brands fa-google-drive"
                                        aria-hidden="true"
                                    />
                                    Drive
                                </a>
                                <a
                                    className="am-google-btn"
                                    href="https://docs.new"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <i
                                        className="fa-solid fa-file-lines"
                                        aria-hidden="true"
                                    />
                                    New Doc
                                </a>
                                <a
                                    className="am-google-btn"
                                    href="https://sheets.new"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <i
                                        className="fa-solid fa-table"
                                        aria-hidden="true"
                                    />
                                    New Sheet
                                </a>
                                <a
                                    className="am-google-btn"
                                    href="https://slides.new"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <i
                                        className="fa-solid fa-display"
                                        aria-hidden="true"
                                    />
                                    New Slides
                                </a>
                            </div>
                            <div className="am-google-link">
                                <input
                                    type="url"
                                    id="am-link-input"
                                    maxLength={500}
                                    placeholder="Paste the link of your Google Drive / Docs / Sheets / Slides file"
                                    aria-label="Google file link"
                                    value={linkValue}
                                    onChange={(e) =>
                                        setLinkValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddLink();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    id="am-link-add"
                                    onClick={handleAddLink}
                                >
                                    Add link
                                </button>
                            </div>
                            <small className="am-google-hint">
                                Open Drive or create a file, then copy its link
                                here. Share it so your tutor can open it (Share
                                &rarr; &ldquo;Anyone with the link&rdquo; or add
                                their e-mail).
                            </small>
                            <small
                                className="am-google-error"
                                id="am-link-error"
                                role="alert"
                            >
                                {linkError}
                            </small>
                        </div>
                    )}

                    <div className="am-actions">
                        <button
                            type="button"
                            className="am-btn-cancel"
                            id="amBtnCancel"
                            disabled={busy}
                            onClick={() => !busy && onClose()}
                        >
                            <i
                                className={
                                    isView
                                        ? 'fa-solid fa-xmark'
                                        : 'fa-solid fa-trash-can'
                                }
                                aria-hidden="true"
                            />
                            {isView ? 'Close' : 'Cancel'}
                        </button>
                        {!isView && (
                            <button
                                type="submit"
                                className="am-btn-confirm"
                                id="amBtnConfirm"
                                disabled={busy}
                            >
                                {busy
                                    ? 'Saving...'
                                    : mode === 'edit'
                                    ? 'Save Changes'
                                    : 'Add Evidence'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

/**
 * Tutor Activity Modal (Assign New Activity / Edit Activity)
 */
export function TutorActivityModal({
    open,
    mode = 'create', // 'create' | 'edit'
    activity = null,
    busy = false,
    onClose,
    onSubmit,
}) {
    const [nombre, setNombre] = useState('');
    const [description, setDescription] = useState('');
    const [assignedDate, setAssignedDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [files, setFiles] = useState([]);
    const [nameError, setNameError] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const nameInputRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        setNameError(false);
        if (mode === 'edit' && activity) {
            setNombre(activity.title || activity.name || '');
            setDescription(activity.description || '');
            setAssignedDate(
                formatForDateTimeLocal(
                    activity.assignedDate || activity.createdAt
                )
            );
            setDueDate(
                formatForDateTimeLocal(activity.dueDate || activity.deadline)
            );
            setFiles(
                (activity.files || []).map((f) => ({ ...f, isExisting: true }))
            );
        } else {
            setNombre('');
            setDescription('');
            setAssignedDate(formatForDateTimeLocal(new Date()));
            setDueDate('');
            setFiles([]);
        }
        document.body.style.overflow = 'hidden';
        setTimeout(() => nameInputRef.current?.focus(), 50);
        return () => {
            document.body.style.overflow = '';
        };
    }, [open, mode, activity]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, busy, onClose]);

    if (!open) return null;

    const handleAddFiles = (fileList) => {
        if (!fileList || !fileList.length) return;
        setFiles((prev) => [...prev, ...Array.from(fileList)]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (busy) return;
        const trimmed = nombre.trim();
        if (!trimmed) {
            setNameError(true);
            setTimeout(() => setNameError(false), 1200);
            nameInputRef.current?.focus();
            return;
        }
        const newFiles = files.filter((f) => !f.isExisting);
        const keptFileIds = files.filter((f) => f.isExisting).map((f) => f.id);

        onSubmit({
            mode,
            title: trimmed,
            description: description.trim(),
            assignedDate,
            dueDate,
            newFiles,
            keptFileIds,
        });
    };

    return createPortal(
        <div
            id="am-modal"
            className="am-modal-overlay"
            style={{ display: 'flex' }}
        >
            <div
                className="am-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="am-modal-title"
            >
                <button
                    type="button"
                    className="am-modal-close"
                    id="amModalCloseX"
                    aria-label="Close"
                    onClick={() => !busy && onClose()}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
                <h3 className="am-modal-title" id="am-modal-title">
                    {mode === 'edit' ? 'Edit Activity' : 'Assign New Activity'}
                </h3>

                <form
                    id="am-form"
                    className="am-form"
                    noValidate
                    onSubmit={handleSubmit}
                >
                    <div className="am-field">
                        <label htmlFor="am-nombre">Name</label>
                        <input
                            ref={nameInputRef}
                            type="text"
                            id="am-nombre"
                            name="nombre"
                            className={nameError ? 'am-input-error' : undefined}
                            placeholder="Enter activity name"
                            autoComplete="off"
                            required
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                    </div>

                    <div className="am-field">
                        <label htmlFor="am-desc">Description (optional)</label>
                        <textarea
                            id="am-desc"
                            name="descripcion"
                            rows="3"
                            placeholder="Enter activity description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="am-field-row">
                        <div className="am-field">
                            <label htmlFor="am-fecha-asig">
                                Assignment Date
                            </label>
                            <CustomDateTimePicker
                                id="am-fecha-asig"
                                name="fecha-asignacion"
                                type="datetime-local"
                                required
                                value={assignedDate}
                                onChange={(e) =>
                                    setAssignedDate(e.target.value)
                                }
                            />
                        </div>
                        <div className="am-field">
                            <label htmlFor="am-fecha-limite">
                                Deadline (optional)
                            </label>
                            <CustomDateTimePicker
                                id="am-fecha-limite"
                                name="fecha-limite"
                                type="datetime-local"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div
                        className={`am-dropzone${
                            isDragOver ? ' is-dragover' : ''
                        }`}
                        id="am-dropzone"
                        tabIndex={0}
                        role="button"
                        aria-label="Attach activity files"
                        onClick={(e) => {
                            if (
                                e.target.closest('a') ||
                                e.target.closest('button')
                            )
                                return;
                            fileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(true);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(true);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(false);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragOver(false);
                            if (e.dataTransfer?.files) {
                                handleAddFiles(e.dataTransfer.files);
                            }
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="am-file-input"
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            multiple
                            hidden
                            onChange={(e) => {
                                handleAddFiles(e.target.files);
                                e.target.value = '';
                            }}
                        />
                        <i
                            className="fa-solid fa-cloud-arrow-up"
                            aria-hidden="true"
                        />
                        <strong>Attach Activity Files</strong>
                        <span>Drag files here or click to upload</span>
                        <div
                            className={`am-file-list${
                                files.length ? ' has-files' : ''
                            }`}
                            id="am-file-list"
                        >
                            {files.map((f, idx) => (
                                <span key={idx} className="am-file-chip">
                                    <i
                                        className="fa-solid fa-paperclip"
                                        aria-hidden="true"
                                    />
                                    {f.isExisting ? (
                                        <a
                                            href={f.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="am-file-chip-name"
                                            style={{
                                                textDecoration: 'none',
                                                color: 'inherit',
                                            }}
                                        >
                                            {f.name}
                                        </a>
                                    ) : (
                                        <span className="am-file-chip-name">
                                            {f.name}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="am-file-remove"
                                        aria-label={`Remove ${f.name}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFiles((prev) =>
                                                prev.filter((_, i) => i !== idx)
                                            );
                                        }}
                                    >
                                        <i
                                            className="fa-solid fa-xmark"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="am-actions">
                        <button
                            type="button"
                            className="am-btn-cancel"
                            id="amBtnCancel"
                            disabled={busy}
                            onClick={() => !busy && onClose()}
                        >
                            <i className="fa-solid fa-trash-can" />
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="am-btn-confirm"
                            disabled={busy}
                        >
                            {busy ? 'Saving...' : 'Confirm Assignment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

/**
 * Read-Only Evidence Modal for Tutor, Advisor, and Director
 */
export function ViewEvidenceModal({ evidence, onClose }) {
    if (!evidence) return null;
    const files = evidence.files || [];

    return createPortal(
        <div
            id="view-evidence-modal"
            className="am-modal-overlay"
            style={{ display: 'flex', zIndex: 10000 }}
        >
            <div
                className="am-modal"
                role="dialog"
                aria-modal="true"
                style={{ maxWidth: '500px', width: '90%' }}
            >
                <button
                    type="button"
                    className="am-modal-close"
                    id="veModalCloseX"
                    aria-label="Close"
                    onClick={onClose}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
                <h3 className="am-modal-title">View Evidence</h3>

                <div className="am-form">
                    <div className="am-field">
                        <label>Hours Worked</label>
                        <input
                            type="text"
                            id="ve-hours"
                            className="act-value-box act-input"
                            readOnly
                            value={evidence.hours || 0}
                        />
                    </div>
                    <div className="am-field">
                        <label>Description</label>
                        <textarea
                            id="ve-desc"
                            rows="4"
                            readOnly
                            value={
                                evidence.description ||
                                'No description provided'
                            }
                        />
                    </div>
                    <div className="am-field">
                        <label>Files</label>
                        <div
                            className="am-dropzone"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                margin: 0,
                                pointerEvents: 'auto',
                            }}
                        >
                            <div
                                className="am-file-list has-files"
                                id="ve-file-list"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                }}
                            >
                                {files.length > 0 ? (
                                    files.map((f, idx) => (
                                        <span
                                            key={idx}
                                            className="am-file-chip"
                                            style={{
                                                marginBottom: '8px',
                                                width: '100%',
                                                padding: '12px 16px',
                                                justifyContent: 'flex-start',
                                                borderRadius: '24px',
                                            }}
                                        >
                                            <i
                                                className={fileIcon(f)}
                                                aria-hidden="true"
                                                style={{
                                                    marginRight: '12px',
                                                    fontSize: '1.1rem',
                                                    color: 'var(--clr-primary-dark, #103323)',
                                                }}
                                            />
                                            <a
                                                href={f.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="am-file-chip-name"
                                                style={{
                                                    textDecoration: 'none',
                                                    color: 'var(--clr-primary-dark, #103323)',
                                                    cursor: 'pointer',
                                                    flex: 1,
                                                    fontWeight: 600,
                                                    fontSize: '1rem',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                {f.name}
                                            </a>
                                            <button
                                                type="button"
                                                className="am-file-view am-file-download-btn"
                                                title="Download"
                                                style={{
                                                    color: 'var(--clr-primary-dark, #103323)',
                                                    marginLeft: '8px',
                                                    fontSize: '1.3rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    descargarArchivo(
                                                        f.url,
                                                        f.name
                                                    );
                                                }}
                                            >
                                                <i
                                                    className="fa-solid fa-download"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </span>
                                    ))
                                ) : (
                                    <span
                                        style={{
                                            color: '#666',
                                            fontStyle: 'italic',
                                            display: 'block',
                                            padding: '12px',
                                        }}
                                    >
                                        No files attached
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div
                        className="am-actions"
                        style={{ justifyContent: 'center' }}
                    >
                        <button
                            type="button"
                            className="am-btn-cancel"
                            id="veBtnCancel"
                            style={{ margin: 0 }}
                            onClick={onClose}
                        >
                            <i
                                className="fa-solid fa-xmark"
                                aria-hidden="true"
                            />
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/**
 * Feedback Full Text Modal (all 4 roles)
 */
export function ViewFeedbackModal({ text, onClose }) {
    if (text === null || text === undefined) return null;
    return createPortal(
        <div
            id="view-feedback-modal"
            className="am-modal-overlay"
            style={{ display: 'flex', zIndex: 10000 }}
        >
            <div
                className="am-modal"
                role="dialog"
                aria-modal="true"
                style={{ maxWidth: '450px' }}
            >
                <button
                    type="button"
                    className="am-modal-close"
                    id="vfModalCloseX"
                    aria-label="Close"
                    onClick={onClose}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
                <h3 className="am-modal-title" style={{ marginBottom: '20px' }}>
                    Feedback
                </h3>

                <div
                    id="vf-content"
                    className="am-modal-text"
                    style={{
                        fontSize: '1rem',
                        marginBottom: '30px',
                        lineHeight: 1.5,
                        fontFamily: "'Inter', sans-serif",
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {text || 'No feedback provided'}
                </div>

                <div
                    className="am-actions"
                    style={{ justifyContent: 'center' }}
                >
                    <button
                        type="button"
                        className="am-btn-confirm"
                        id="vfBtnAccept"
                        style={{
                            margin: 0,
                            backgroundColor: '#901010',
                            color: 'white',
                        }}
                        onClick={onClose}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/**
 * Confirm Delete Modal (Evidence / Activity / Feedback)
 */
export function ConfirmDeleteModal({
    config, // { type: 'evidence' | 'activity' | 'feedback', hours, name, onConfirm }
    busy = false,
    onClose,
}) {
    if (!config) return null;
    const isFeedback = config.type === 'feedback';
    const isEvidence = config.type === 'evidence';

    return createPortal(
        <div
            id={isFeedback ? 'delete-feedback-modal' : 'delete-confirm-modal'}
            className="am-modal-overlay"
            style={{ display: 'flex', zIndex: 10000 }}
        >
            <div
                className="am-modal"
                role="dialog"
                aria-modal="true"
                style={{ maxWidth: '450px' }}
            >
                <button
                    type="button"
                    className="am-modal-close"
                    aria-label="Close"
                    onClick={() => !busy && onClose()}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
                <h3 className="am-modal-title" style={{ marginBottom: '20px' }}>
                    Confirm Deletion
                </h3>

                <div
                    className="am-modal-text"
                    style={{
                        fontSize: '1rem',
                        marginBottom: '30px',
                        lineHeight: 1.5,
                        fontFamily: "'Inter', sans-serif",
                    }}
                >
                    {isFeedback ? (
                        <>
                            Are you sure you want to delete this feedback?
                            <br />
                            <br />
                            This action cannot be undone.
                        </>
                    ) : isEvidence ? (
                        <>
                            Are you sure you want to delete this activity?
                            <br />
                            <br />
                            The{' '}
                            <strong id="delete-confirm-hours">
                                {config.hours || 0}
                            </strong>{' '}
                            registered hours and the description will be
                            permanently deleted.
                            <br />
                            <br />
                            This action cannot be undone.
                        </>
                    ) : (
                        <>
                            Are you sure you want to delete this activity?
                            <br />
                            <br />
                            The activity{' '}
                            <strong id="delete-confirm-name">
                                {config.name}
                            </strong>{' '}
                            and its description will be permanently deleted.
                            <br />
                            <br />
                            This action cannot be undone.
                        </>
                    )}
                </div>

                <div
                    className="am-actions"
                    style={{ justifyContent: 'flex-start', gap: '16px' }}
                >
                    <button
                        type="button"
                        className="am-btn-cancel"
                        style={{ margin: 0 }}
                        disabled={busy}
                        onClick={() => !busy && onClose()}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="am-btn-confirm"
                        style={{
                            margin: 0,
                            backgroundColor: '#901010',
                            color: 'white',
                        }}
                        disabled={busy}
                        onClick={() => config.onConfirm && config.onConfirm()}
                    >
                        {isFeedback ? 'Delete' : 'Delete Activity'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

/**
 * Success Notice Modal
 */
export function SuccessNoticeModal({ notice, onClose }) {
    if (!notice) return null;
    return createPortal(
        <div
            className="am-modal-overlay"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
            }}
        >
            <div
                className="am-modal"
                role="dialog"
                aria-modal="true"
                style={{
                    maxWidth: '450px',
                    width: '90%',
                    textAlign: 'center',
                    padding: '40px 30px',
                    borderRadius: '20px',
                    position: 'relative',
                }}
            >
                <button
                    type="button"
                    className="am-modal-close"
                    aria-label="Close"
                    style={{ top: '15px', right: '15px' }}
                    onClick={onClose}
                >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>

                <h3
                    className="am-modal-title"
                    style={{
                        marginTop: 0,
                        marginBottom: '20px',
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '1.8rem',
                        fontWeight: 700,
                    }}
                >
                    {notice.title || 'Success'}
                </h3>

                <div style={{ marginBottom: '20px' }}>
                    <i
                        className="fa-solid fa-check"
                        style={{ fontSize: '3rem', color: '#6e8b7c' }}
                    />
                </div>

                <div
                    className="am-modal-text"
                    style={{
                        fontSize: '1.1rem',
                        marginBottom: '30px',
                        lineHeight: 1.4,
                        fontFamily: "'Inter', sans-serif",
                    }}
                >
                    {notice.message}
                </div>

                <div
                    className="am-actions"
                    style={{ justifyContent: 'center' }}
                >
                    <button
                        type="button"
                        className="am-btn-confirm"
                        style={{
                            margin: 0,
                            backgroundColor: '#901010',
                            color: 'white',
                            padding: '12px 30px',
                        }}
                        onClick={onClose}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
