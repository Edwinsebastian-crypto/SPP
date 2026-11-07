'use strict';

/** Data of the "Home" screen; the content depends on the role of the logged-in user. */
class HomeController {
  constructor({ homeService }) {
    this.homeService = homeService;
  }

  /** GET /api/home */
  get = async (req, res) => {
    res.json({ home: await this.homeService.build(req.user) });
  };
}

module.exports = HomeController;
