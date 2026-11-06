# Home / Start screen

Landing screen shared by the four panels (student, tutor, advisor, director). It is the **first option of the
sidebar menu** and the section that opens as soon as the user signs in. Data comes from `GET /api/home`.

## How it is wired

| Layer | File |
| --- | --- |
| Route `GET /api/home` (any authenticated user) | [src/routes/home.routes.js](../src/routes/home.routes.js) |
| Controller | [src/controllers/home.controller.js](../src/controllers/home.controller.js) |
| Service (role-specific payload, read-only) | [src/services/home.service.js](../src/services/home.service.js) |
| Composition root | [src/container.js](../src/container.js) (`homeService`, `controllers.home`) |
| API mount | [src/routes/index.js](../src/routes/index.js) (`router.use('/home', ...)`) |
| Styles | [public/css/home.css](../public/css/home.css) |
| Panel script | [public/js/pages/home.js](../public/js/pages/home.js) |
| Unit test | [tests/home.service.test.js](../tests/home.service.test.js) |

The `Home` link, the `#home` section (`#home-root`) and the `home.css` / `home.js` includes are added to
`public/pages/{student,tutor,advisor,director}.html` by:

```bash
node scripts/install-home.js --check   # dry run
node scripts/install-home.js           # idempotent; writes a .bak the first time
```

## Landing behaviour

- [public/js/core/shell.js](../public/js/core/shell.js) marks the **first menu option** as active and shows the
  section it points to. A panel may declare its sections in a different order than its menu, so the target is
  resolved through the link's `href`, not by document order.
- An explicit `#hash` still wins (for example `/pages/director.html#reports`).
- [public/js/pages/home.js](../public/js/pages/home.js) loads the data on start and refreshes it after 30 s or when
  the user comes back to Home through the sidebar.

## What each role sees

- **Student:** practice card, hours, activity status, upcoming deadlines and latest feedback.
- **Tutor / Advisor:** review queue, totals, deadlines and one card per student (the advisor only counts advisor
  comments as reviewed).
- **Director:** program summary, practices by status, pending registrations, students without a practice,
  practices ending within 21 days and the recent audit trail.

## Notes

- 30 s client-side cache; the refresh button forces a reload.
- No inline scripts or handlers (CSP friendly): everything uses event delegation on `data-home="..."`.
- Respects `prefers-reduced-motion` and `body.dark-theme`.
- The service only composes what the existing repositories already expose: no new SQL tables and no extra
  permission rules (each role only asks for the practices assigned to it).
