const jwt = require("jsonwebtoken");
const { prisma } = require("../db");

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
		if (!req.userId) return next();

		const user = await prisma.query.user({ where: { id: req.userId } }, userObject);
		req.user = user;

		next();
	}
};
