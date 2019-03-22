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
	debug: process.env.NODE_ENV === "development"
});

const corsConfig = {
	origin: [
		"http://localhost:3000",
		"https://www.up4.life",
		"https://up4.life",
		"https://up4lifee.herokuapp.com",
		"*.herokuapp.com",
		"http://up4lifee.herokuapp.com"
	],
	credentials: true
};

const app = express();

app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());
app.use(isAuth);
app.use(populateUser);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: "/" });

const server = http.createServer(app);

apolloServer.installSubscriptionHandlers(server);

server.listen(process.env.PORT || 4000, () => {
	console.log("woo server uppp");
});
