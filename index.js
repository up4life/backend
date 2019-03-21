// require("dotenv").config({ path: "./.env" });
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
	origin: ["http://localhost:3000", "https://www.up4.life"],
	credentials: true
};
// const configurations = {
// 	production: {
// 		ssl: false,
// 		port: process.env.PORT || 4000,
// 		hostname: "api.up4.life"
// 	},
// 	development: { ssl: false, port: process.env.PORT || 4000, hostname: "localhost" }
// };

// const environment = process.env.NODE_ENV || "production";
// const config = configurations[environment];
const app = express();

// app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

app.use(isAuth);
app.use(populateUser);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: "/" });

const server = http.createServer(app);

apolloServer.installSubscriptionHandlers(server);

server.listen();
