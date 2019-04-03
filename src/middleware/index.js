const jwt = require('jsonwebtoken');
const {
	prisma: { query }
} = require('../db');

const userObject = `{
  id
  email
  firstName
  lastName
  gender
  dob
  location
  permissions
  genderPrefs
  minAgePref
  maxAgePref
  stripeCustomerId
  stripeSubscriptionId
  img {
    img_url
  }
  blocked {
    id
  }
  events {
    id
  }
}`;

module.exports = {
	isAuth: async function(req, res, next) {
		const { token } = req.cookies;

		if (token) {
			const { userId } = jwt.verify(token, process.env.APP_SECRET);
			req.userId = userId;
		}

		next();
	},

	populateUser: async function(req, res, next) {
		const id = req.userId;
		if (!id) return next();

		const user = await query.user({ where: { id } }, userObject);
		req.user = user;

		next();
	},

	errorHandler: function(err, req, res, next) {
		if (res.headersSent) {
			return next(err);
		}
		const { status } = err;
		res.status(status).json(err);
	}
};
