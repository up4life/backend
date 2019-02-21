const axios = require('axios');
const { transformEvents, fetchEvents, setDates } = require('../utils');
const stripe = require('../stripe');

const Query = {
	currentUser(parent, args, { db, request }, info) {
		// check if there is a current user ID
		if (!request.userId) {
			return null;
		}
		return db.query.user(
			{
				where: { id: request.userId }
			},
			info
		);
	},
	user(parent, args, { db }, info) {
		// finds a user based on the args provided in the mutation
		return db.query.user(
			{
				...args
			},
			info
		);
	},
	async getEvents(parent, { location, alt, page, ...args }, ctx, info) {
		location = location.split(',')[0].toLowerCase();

		let cats = args.categories
			? args.categories
			: ['KZFzniwnSyZfZ7v7nJ', 'KZFzniwnSyZfZ7v7na', 'KZFzniwnSyZfZ7v7nE', 'KZFzniwnSyZfZ7v7n1'];

		const dates = args.dates ? setDates(args.dates.toString()) : undefined;
		let events;

		let response = await fetchEvents(location, cats, dates, page, 200);

		events = response.data._embedded.events;

		let uniques = events.reduce((a, t) => {
			if (!a.includes(t.name)) a.push(t.name);
			return a;
		}, []);

		if (response.data.page.totalElements > 20) {
			while (uniques.length < 20) {
				page = page + 1;

				let res = await fetchEvents(location, cats, dates, page, 200);

				if (!res.data._embedded) break;
				else {
					events = [...events, ...res.data._embedded.events];
					uniques = res.data._embedded.events.reduce((a, t) => {
						if (!a.includes(t.name)) a.push(t.name);
						return a;
					}, uniques);
				}
			}
		}

		return {
			events: transformEvents(events),
			page_count: response.data.page.size,
			total_items: response.data.page.totalElements,
			page_total: response.data.page.totalPages,
			page_number: response.data.page.number,
			location: location
		};
	},

	async getEvent(parent, args, ctx, info) {
		const { data } = await axios.get(
			`https://app.ticketmaster.com/discovery/v2/events/${args.id}.json?apikey=${
				process.env.TKTMSTR_KEY
			}`
		);
		const [img] = data.images.filter(img => img.ratio === '4_3');
		return {
			title: data.name,
			id: data.id,
			url: data.url,
			location: {
				city: data._embedded ? data._embedded.venues[0].city.name : 'poop',
				venue: data._embedded ? data._embedded.venues[0].name : 'poopoo',
				address: data._embedded ? data._embedded.venues[0].address.line1 : 'damnit 3',
				zipCode: data._embedded ? data._embedded.venues[0].postalCode : 'shit 4'
			},
			image_url: img.url,
			description: data.info,
			times: [data.dates.start.dateTime]
			// data.dates.status.code (might be good for things like rescheduled events)
			// data.pleaseNote (has additional info for things that are rescheduled or something like that it seems)
			// optional data points to include
			// data.priceRanges[0].currency
			// data.priceRanges[0].min (min ticket price)
			// data.priceRanges[0].max (higheest price)
			// data.classifications.genre.name or .subGenre.name
			// data.seatmap.staticUrl (link to seating map)
			// data.products (includes things sold with it like parking, etc..
			// data.sales.public.startDateTime && endDateTime (when tickets start and end being on sale to public)
		};
	},
	async getLocation(parent, { latitude, longitude }, ctx, info) {
		const location = await axios.get(
			`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude}, ${longitude}&key=${
				process.env.GOOGLE_API_KEY
			}`
		);
		let city = location.data.results[0].address_components[3].long_name;
		let state = location.data.results[0].address_components[5].short_name;
		let county = location.data.results[0].address_components[4].long_name;

		return {
			city: `${city}, ${state}`,
			county: `${county}, ${state}`
		};
	},
	async locationSearch(parent, args, { db }, info) {
		const response = await axios(
			`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${
				args.city
			}&types=(cities)&key=${process.env.GOOGLE_API_KEY}`
		);
		const results = response.data.predictions;
		const city = results.map(result => {
			return { city: result.description };
		});
		return city;
	},
	async geoHash(parent, { city }, { db }, info) {
		const response = await axios(
			`https://maps.googleapis.com/maps/api/geocode/json?address=${city}&key=${
				process.env.GOOGLE_API_KEY
			}`
		);
		let { lat, lng } = response.data.results[0].geometry.location;

		const geoResponse = await axios(`http://geohash.org?q=${lat},${lng}&format=url`);
		let geoHash = geoResponse.data.replace('http://geohash.org/', '').slice(0, 8);
		return { geoHash };
	},
	async getUserOrder(parent, args, ctx, info) {
		// Check user's login status
		const { userId } = ctx.request;
		if (!userId) throw new Error('You must be signed in to access orders.');

		return ctx.db.query.orders(
			{
				where: {
					user: {
						id: args.userId
					}
				}
			},
			info
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
			`
		);
		// TO DO: define subscription level and benefit!!!
		let datesCount = 5;
		if (user.permissions[0] === 'MONTHLY') datesCount += 3;
		if (user.permissions[0] === 'YEARLY') datesCount += 5;

		return { count: datesCount - user.events.length };
	},
	async invoicesList(parent, args, ctx, info) {
		const { userId, user } = ctx.request;
		if (!userId) throw new Error('You must be signed in to access this app.');

		const invoices = await stripe.invoices.list({
			customer: user.stripeCustomerId
		});

		return invoices.data;
	}
};

module.exports = Query;
