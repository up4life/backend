require('dotenv').config({ path: './.env' });
const { ApolloServer } = require('apollo-server-express');
const cookieParser = require('cookie-parser');
const express = require('express');
const http = require('http');

const schema = require('./src/schema');
const db = require('./src/db');
const { isAuth, populateUser, errorHandler } = require('./src/middleware/index');

const apolloServer = new ApolloServer({
	schema,
	context: ({ req, res, connection }) => {
		if (connection && connection.context && connection.context.auth) {
			console.log(connection.context, 'websocket connection ctx (backend)');
			req.auth = connection.context.auth;
		}

		return {
			...req,
			db
		};
	},
	playground: true,
	introspection: true,
	debug: true
});

const corsConfig = {
	origin: ['http://localhost:3000', 'https://www.up4.life', 'https://up4.life'],
	credentials: true
};

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

app.use(isAuth);
app.use(populateUser);
app.use(errorHandler);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: '/' });

const server = http.createServer(app);

// apolloServer.installSubscriptionHandlers(server);

server.listen().then(({ url, subscriptionsUrl }) => {
	console.log(`🚀 Server ready at ${url}`);
	console.log(`🚀 Subscriptions ready at ${subscriptionsUrl}`);
});

// server.listen(process.env.PORT || 4000, () => {
// 	console.log("woo server uppp");
// });
