require("dotenv").config({ path: "./.env" });
const { ApolloServer } = require("apollo-server-express");
const cookieParser = require("cookie-parser");
const express = require("express");
const https = require("https");
const http = require("http");

const schema = require("./src/schema");
const { bindings } = require("./src/db");
const { isAuth, populateUser } = require("./src/middleware/index");

const apolloServer = new ApolloServer({
	schema,
	context: ({ req }) => ({
		...req,
		db: bindings
	}),
	playground: true,
	introspection: true,
	debug: process.env.NODE_ENV === "development"
});

const corsConfig = {
	origin: [
		"https://up4lifee.herokuapp.com",
		"/.herokuapp.com$/",
		"http://localhost:4000",
		"www.up4.life",
		"https://www.up4.life"
	],
	credentials: true
};
const configurations = {
	production: {
		ssl: false,
		port: process.env.PORT || 4000,
		hostname: "api.up4.life"
	},
	development: { ssl: false, port: process.env.PORT || 4000, hostname: "localhost" }
};

const environment = process.env.NODE_ENV || "production";
const config = configurations[environment];
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

app.use(isAuth);
app.use(populateUser);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: "/" });

var server;
if (config.ssl) {
	server = http.createServer(app);
} else {
	server = http.createServer(app);
}

apolloServer.installSubscriptionHandlers(server);

server.listen(process.env.PORT || 4000, () => {
	console.log(
		"🚀 Server ready at",
		`http${config.ssl ? "s" : ""}://${config.hostname}:${process.env.PORT || 4000}${
			apolloServer.graphqlPath
		}`
	);
	console.log(apolloServer.subscriptionPath);
});

// httpServer.listen(port, () => {
// 	console.log(`🚀 Server ready at http://localhost:${port}${server.graphqlPath}`);
// 	console.log(`🚀 Subscriptions ready at ws://localhost:${port}${server.subscriptionsPath}`);
// });
