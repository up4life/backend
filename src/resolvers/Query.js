const { forwardTo } = require('prisma-binding');
const axios = require('axios');
const moment = require('moment');
const { transformEvents, fetchEvents } = require('../utils');
const { checkDates } = require('../utils');

const Query = {
	users: forwardTo('db'),
	events: forwardTo('db'),
	currentUser(parent, args, { db, request }, info) {
		// check if there is a current user ID
		if (!request.userId) {
			return null;
		}
		return db.query.user(
			{
				where: { id: request.userId },
			},
			info,
		);
	},
	user(parent, args, { db }, info) {
		// finds a user based on the args provided in the mutation
		return db.query.user(
			{
				...args,
			},
			info,
		);
	},
	async getEvents(parent, { location, alt, page, ...args }, ctx, info) {
		// var now = moment.now();
		// console.log(location, args.dates);
		let categories = args.categories
			? args.categories.toString()
			: 'music,comedy,performing_arts,sports';
		let dates = args.dates ? args.dates.toString() : 'all';
		// console.log(categories, dates, page, location);
		let response = await fetchEvents(location, categories, dates, page);

		let data = response.data,
			events;

		if (data.events) {
			events = transformEvents(data.events);
		} else {
			response = await fetchEvents(alt, categories, dates, page);
			data = response.data;
			events = transformEvents(data.events);
		}
		if (!data) {
			throw new Error('There is no event info for your current location');
		}
		
		let filteredEvents = [];
		if (args.dates.includes('All') || args.dates.length === 0) {
			filteredEvents = [...events];
		} else {
			filteredEvents = args.dates.reduce((e, date) => [...e, ...checkDates(date, events)], []) ;
		}

		return {
			events: filteredEvents,
			total_items: data.total_items, // this is no longer correct coz we filtered the events
			page_count: data.page_count,
			page_number: data.page_number,
			location: location,
		};
	},

	async getEvent(parent, args, ctx, info) {
		const { data } = await axios.get(
			`http://api.eventful.com/json/events/get?&id=${args.id}&app_key=${process.env.API_KEY}`,
		);
		console.log(data);
		return {
			title: data.title,
			id: data.id,
			url: data.url || null,
			location: {
				city: data.city_name,
				venue: data.venue_name,
				address: data.venue_address,
				zipCode: data.postal_code,
			},
			image_url: data.images
				? data.images.image.medium && data.images.image.medium.url
				: 'https://screenshotlayer.com/images/assets/placeholder.png',
			description: data.description || null,
			times: [ data.start_time ],
		};
	},
	async getLocation(parent, { latitude, longitude }, ctx, info) {
		const location = await axios.get(
			`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude}, ${longitude}&key=${process
				.env.GOOGLE_API_KEY}`,
		);

		let city = location.data.results[0].address_components[3].long_name;
		let state = location.data.results[0].address_components[5].short_name;
		let county = location.data.results[0].address_components[4].long_name;
		console.log(city, county, state);

		return {
			city: `${city}, ${state}`,
			county: `${county}, ${state}`,
		};
	},
	async locationSearch(parent, args, { db }, info) {
		const response = await axios(
			`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${args.city}&types=(cities)&key=${process
				.env.GOOGLE_API_KEY}`,
		);
		const results = response.data.predictions;
		const city = results.map(result => {
			return { city: result.description };
		});
		return city;
	},
	async getUserOrder(parent, args, ctx, info) {
		// Check user's login status
		const { userId } = ctx.request;
		if (!userId) throw new Error('You must be signed in to access orders.');

		return ctx.db.query.orders(
			{
				where: {
					user: {
						id: args.userId,
					},
				},
			},
			info,
		);
	},

	async getRemainingDates(parent, args, ctx, info) {
		// Check user's login status
		const { userId } = ctx.request;
		if (!userId) throw new Error('You must be signed in to access this app.');

		const user = await ctx.db.query.user(
			{ where: { id: userId } },
			`
				{id permissions events {id}}
			`,
		);

		// TO DO: define subscription level and benefit!!!
		let datesCount = 5;
		if (user.permissions[0] === 'MONTHLY') datesCount += 3;
		if (user.permissions[0] === 'YEARLY') datesCount += 5;

		return { count: datesCount - user.events.length };
	},
};

module.exports = Query;
