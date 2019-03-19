const jwt = require("jsonwebtoken");
const { bindings } = require("../db");

module.exports = {
	isAuth: async function(req, res, next) {
		const { token } = req.cookies;

		if (token) {
			const { userId } = jwt.verify(token, process.env.APP_SECRET);
			req.userId = userId;
		}
		return next();
	},

	populateUser: async function(req, res, next) {
		if (!req.userId) return next();

		const user = await bindings.query.user(
			{ where: { id: req.userId } },
			"{ id, email, firstName, lastName, img { img_url}, location, permissions, dob stripeCustomerId, stripeSubscriptionId, events { id }, maxAgePref, minAgePref, genderPrefs gender blocked { id }}"
		);

		req.user = user;

		return next();
	}
};
