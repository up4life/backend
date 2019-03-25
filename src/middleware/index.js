const jwt = require("jsonwebtoken");
const { bindings } = require("../db");

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
    tmID
    attending {
      id
    }
  }
}`;

module.exports = {
	isAuth: async function(req, res, next) {
		const { token } = req.cookies;
		const { cookie } = req.headers;

		if (token) {
			// console.log(cookie, "cookie here");
			const { userId } = jwt.verify(token, process.env.APP_SECRET);
			req.userId = userId;
		}

		next();
		// console.log("ohai", req);
		// console.log("req.body", req.body, "req._body", req._body);

		// if (cookie && !token) {
		// 	console.log(cookie, "cookie here/no token");
		// }
	},

	populateUser: async function(req, res, next) {
		if (!req.userId) return next();

		const user = await bindings.query.user({ where: { id: req.userId } }, userObject);
		req.user = user;

		next();
	}
};
