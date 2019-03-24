require("dotenv").config({ path: "./.env" });
const { ApolloServer } = require("apollo-server-express");
const cookieParser = require("cookie-parser");
const express = require("express");
const http = require("http");

const schema = require("./src/schema");
const { bindings } = require("./src/db");
const { isAuth, populateUser } = require("./src/middleware/index");

const apolloServer = new ApolloServer({
	schema,
	context: ({ req }) => ({
		...req,
		db: { ...bindings.query, ...bindings.mutation, subscription: bindings.subscription }
	}),
	playground: true,
	introspection: true,
	debug: true
});

const corsConfig = {
	origin: [
		"http://localhost:3000",
		"https://www.up4.life",
		"https://up4.life",
		"https://up4lifee.herokuapp.com",
		"*.herokuapp.com",
		"https://up4.holdeelocks.now.sh"
	],
	credentials: true
};

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());
app.use(isAuth);
app.use(populateUser);

const errorHandler = (err, req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}
	const { status } = err;
	res.status(status).json(err);
};
app.use(errorHandler);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: "/" });

const server = http.createServer(app);

apolloServer.installSubscriptionHandlers(server);

server.listen(process.env.PORT || 4000, () => {
	console.log("woo server uppp");
});
