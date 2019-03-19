require("dotenv").config({ path: "./.env" });
const { makeExecutableSchema } = require("apollo-server");
const { applyMiddleware } = require("graphql-middleware");
const { importSchema } = require("graphql-import");

const typeDefs = importSchema("./src/schema/schema.graphql");
const { resolvers } = require("../resolvers");

const middleware = [
	async function isAuth(resolve, parent, args, ctx, info) {
		const { token, session } = ctx.cookies;
		if (!token) {
			resolve(parent, args, ctx, info);
		} else {
			const { userId } = jwt.verify(token, process.env.APP_SECRET);

			ctx.userId = userId;
		}
		return resolve(parent, args, ctx, info);
	},
	async function populateUser(resolve, parent, args, ctx, info) {
		if (!ctx.userId) return resolve();
		console.log("made it here");
		const user = await ctx.db.query.user(
			{ id: ctx.userId },
			"{ id, email, firstName, lastName, img { img_url}, location, permissions, dob stripeCustomerId, stripeSubscriptionId, events { id }, maxAgePref, minAgePref, genderPrefs age gender blocked { id }}"
		);
		ctx.user = user;
		console.log(ctx.user, "user on ctx here");
		return resolve(parent, args, { ...ctx }, info);
	}
];

const schema = makeExecutableSchema({ typeDefs, resolvers });
const schemaWithMiddleware = applyMiddleware(schema, ...middleware);

module.exports = schemaWithMiddleware;

// module.exports = schema;
