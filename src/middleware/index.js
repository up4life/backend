const jwt = require("jsonwebtoken");
const { bindings } = require("../db");

module.exports = {
	isAuth: async function(req, res, next) {
		const { token } = req.cookies;
		console.log(req.cookies, "req.cookies here");
		console.log("\n");
		const { cookie } = req.headers;
		// console.log(Object.keys(req.headers), "req.headers here");
		console.log(cookie, "cookie here");
		console.log("\n");
		console.log("\n");
		console.log(req.body, "body here");
		console.log("\n");
		console.log(res.body, "status here");
		if (token) {
			const { userId } = jwt.verify(token, process.env.APP_SECRET);
			req.userId = userId;
			return next();
		}

		if (cookie !== null) {
			const { userId } = jwt.verify(cookie, process.env.APP_SECRET);
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
