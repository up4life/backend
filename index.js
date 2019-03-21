require('dotenv');
const { ApolloServer } = require('apollo-server-express');
const cookieParser = require('cookie-parser');
const express = require('express');
const http = require('http');

const schemaFile = 'index.js';
const dbFile = 'db.js';
const middleFile = 'index.js';

const schemaPath = __dirname + '/src/schema/' + schemaFile;
const dbPath = __dirname + '/src/' + dbFile;
const middlewarePath = __dirname + '/src/middleware' + middleFile;
const schema = require(schemaPath);
const { bindings } = require(dbPath);
const { isAuth, populateUser } = require(middlewarePath);
// const schema = require('./src/schema');
// const { bindings } = require('./src/db');
// const { isAuth, populateUser } = require('./src/middleware/index');

const apolloServer = new ApolloServer({
	schema,
	context: ({ req }) => ({
		...req,
		db: { ...bindings.query, ...bindings.mutation, subscription: bindings.subscription },
	}),
	playground: true,
	introspection: true,
	debug: process.env.NODE_ENV === 'development',
});

const corsConfig = {
	origin: [
		// "https://up4lifee.herokuapp.com",
		// "/.herokuapp.com$/",
		'http://localhost:3000',
		// "www.up4.life",
		'https://www.up4.life',
		'https://up4.life',
		// "up4.life"
	],
	credentials: true,
};
// const configurations = {
// 	production: {
// 		ssl: false,
// 		port: process.env.PORT || 4000,
// 		hostname: 'api.up4.life',
// 	},
// 	development: { ssl: false, port: process.env.PORT || 4000, hostname: 'localhost' },
// };

//const environment = process.env.NODE_ENV || 'production';
//const config = configurations[environment];
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());

app.use(isAuth);
app.use(populateUser);

apolloServer.applyMiddleware({ app, cors: corsConfig, path: '/' });

const server = http.createServer(app);

apolloServer.installSubscriptionHandlers(server);
module.exports = server;
// server.listen().then(({ url }) => {
// 	console.log(`🚀 Server ready at ${url}`);
// });
// server.listen(process.env.PORT || 4000, () => {
// 	console.log(
// 		"🚀 Server ready at",
// 		`http${config.ssl ? "s" : ""}://${config.hostname}:${process.env.PORT || 4000}${
// 			apolloServer.graphqlPath
// 		}`
// 	);
// });
