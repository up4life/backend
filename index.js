require('dotenv').config({ path: './.env' });
const { ApolloServer } = require('apollo-server-express');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const jwt = require('jsonwebtoken');
const express = require('express');

const { isAuth, populateUser, errorHandler } = require('./src/middleware/index');
const { prisma, client } = require('./src/db');
const schema = require('./src/schema');

// email: "holden@loser.ville"
// password: "123holdenb"

const apolloServer = new ApolloServer({
	schema,
	context: async ({ req, connection }) => {
		if (connection) {
			const { token } = connection.context;
			const { userId } = jwt.verify(token, process.env.APP_SECRET);

			return { userId, subscription: prisma.subscription };
		} else {
			return {
				...req,
				client,
				prisma,
				query: prisma.query,
				mutation: prisma.mutation,
				subscription: prisma.subscription
			};
		}
	},
	playground: true,
	introspection: true,
	debug: true,
	subscriptions: {
		onConnect: (connectionParams, webSocket, context) => {
			const token = context.request.headers.cookie.slice(6);
			return { token };
		}
	}
});

const corsConfig = {
	origin: ['http://localhost:3000', 'https://www.up4.life', 'https://up4.life'],
	credentials: true
};

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(express.json());

app.use(isAuth);
app.use(populateUser);
app.use(errorHandler);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: '/' });

const server = createServer(app);

apolloServer.installSubscriptionHandlers(server);

// server.listen().then(({ url, subscriptionsUrl }) => {
// 	console.log(`🚀 Server ready at ${url}`);
// 	console.log(`🚀 Subscriptions ready at ${subscriptionsUrl}`);
// });

server.listen(process.env.PORT || 4000, () => {
	console.log(`🚀 Server ready!!`);
});

// server.listen(process.env.PORT || 4000, () => {
// 	new SubscriptionServer(
// 		{
// 			execute,
// 			subscribe,
// 			schema
// 		},
// 		{
// 			server,
// 			path: '/graphql'
// 		}
// 	);
// });
