require("dotenv").config({ path: "./.env" });
const { ApolloServer } = require("apollo-server-express");
const cookieParser = require("cookie-parser");
const express = require("express");
const https = require("https");
const http = require("http");
const fs = require("fs");

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

// const port = process.env.PORT || 4000;

const corsConfig = {
	origin: [
		"https://www.up4.life",
		"/.herokuapp.com$/",
		"http://localhost:4000",
		"https://up4.life",
		"up4.life"
	],
	credentials: true
};
const configurations = {
	production: {
		ssl: true,
		port: process.env.PORT || 4000,
		// hostname: "localhost"
		hostname: "api.up4.life"
	},
	development: { ssl: false, port: process.env.PORT || 4000, hostname: "localhost" }
};

// const environment = process.env.NODE_ENV || "production";
const config = configurations["production"];
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

app.use(isAuth);
app.use(populateUser);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: "/" });

var server;
if (config.ssl) {
	server = https.createServer(
		// {
		// 	key: fs.readFileSync(`./Certs/www_up4_life.key`),
		// 	cert: fs.readFileSync(`./Certs/www_up4_life.pem`)
		// },
		app
	);
} else {
	server = http.createServer(app);
}

apolloServer.installSubscriptionHandlers(server);

server.listen(process.env.PORT || 4000, () =>
	console.log(
		"🚀 Server ready at",
		`http${config.ssl ? "s" : ""}://${config.hostname}:${process.env.PORT || 4000}${
			apolloServer.graphqlPath
		}`
	)
);
