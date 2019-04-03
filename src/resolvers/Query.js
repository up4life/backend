const { forwardTo } = require('prisma-binding');
const moment = require('moment');
const axios = require('axios');

const { fetchEvents, setDates, getScore, formatEvents } = require('../utils');
const MessageQuery = require('./Messages/MessageQuery');
const UserQuery = require('./User/UserQuery');
const genreFilters = require('../genres');
const stripe = require('../stripe');

const Query = {
	...MessageQuery,
	...UserQuery,
	genres: forwardTo('prisma'),

	async userEvents(parent, args, { user, query }, info) {
		if (!user) throw new Error('You must be logged in to use this feature!');

		return query.events(
			{
				where: {
					attending_some: {
						id: user.id
					}
				}
			},
			info
		);
	},
	async currentUser(parent, args, { userId, query }, info) {
		if (!userId) return null;

		return query.user(
			{
				where: { id: userId }
			},
			info
		);
	},
	async user(parent, args, { userId, query }, info) {
		let score = 0;
		if (args.where.id) {
			score = await getScore(userId, args.where.id, query);
		}

		const user = await query.user(
			{
				...args
			},
			`{
				id
				firstName
				dob
				img {
					id
					default
					img_url
				}
				biography
				events {
					id
				}
				interests {
					id
				}
			}`
		);

		return {
			...user,
			score
		};
	},
	async getEvents(parent, args, { user, query }, info) {
		let location = args.location.split(',')[0].toLowerCase();
		let cats =
			!args.categories || !args.categories.length
				? ['KZFzniwnSyZfZ7v7nJ', 'KZFzniwnSyZfZ7v7na', 'KZFzniwnSyZfZ7v7n1']
				: args.categories;

		const dates = !args.dates || !args.dates.length ? undefined : setDates(args.dates.toString());
		let page = args.page || 0;
		let genres = args.genres && args.genres.length ? args.genres : genreFilters.map(x => x.tmID);

		try {
			let { data } = await fetchEvents(location, cats, dates, page, 30, genres);

			let events = data._embedded.events;
			let uniques = events.reduce((a, t) => {
				if (!a.includes(t.name)) a.push(t.name);
				return a;
			}, []);

			if (data.page.totalElements > 30) {
				while (uniques.length < 30) {
					page = page + 1;
					let res = await fetchEvents(location, cats, dates, page, 30, args.genres);
					if (!res.data._embedded) break;
					else {
						pageNumber = res.data.page.number;
						events = [...events, ...res.data._embedded.events];
						uniques = res.data._embedded.events.reduce((a, t) => {
							if (!a.includes(t.name)) a.push(t.name);
							return a;
						}, uniques);
					}
				}
			}

			let ourEvents = await query.events(
				{
					where: { city: location }
				},
				`{id tmID times attending {id firstName img {id default img_url} dob gender biography minAgePref maxAgePref genderPrefs blocked { id }}}`
			);
			return {
				events: formatEvents(user, events, ourEvents),
				page_count: data.page.size,
				total_items: data.page.totalElements,
				page_total: data.page.totalPages,
				page_number: pageNumber,
				genres: args.genres || [],
				categories: args.categories || [],
				dates: args.dates || [],
				location: args.location
			};
		} catch (e) {
			console.log(e);
		}
	},

	async getEvent(parent, args, ctx, info) {
		const {
			data: { _embedded, dates, images, name, id }
		} = await axios.get(
			`https://app.ticketmaster.com/discovery/v2/events/${args.id}.json?apikey=${
				process.env.TKTMSTR_KEY
			}`
		);

		const [img] = images.filter(img => img.width > 500);
		return {
			id,
			title: name,
			city: _embedded ? _embedded.venues[0].city.name : '',
			venue: _embedded ? _embedded.venues[0].name : '',
			image_url: img.url,
			times: [dates.start.dateTime]
		};
	},
	async getLocation(parent, { latitude, longitude }, ctx, info) {
		const { data } = await axios.get(
			`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude}, ${longitude}&key=${
				process.env.GOOGLE_API_KEY
			}`
		);
		let city = data.results[0].address_components[3].long_name;
		let state = data.results[0].address_components[5].short_name;
		let county = data.results[0].address_components[4].long_name;

		return {
			city: `${city}, ${state}`,
			county: `${county}, ${state}`
		};
	},
	async locationSearch(parent, args, { db }, info) {
		const { data } = await axios(
			`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${
				args.city
			}&types=(cities)&key=${process.env.GOOGLE_API_KEY}`
		);
		const results = data.predictions;
		const city = results.map(result => {
			return { city: result.description };
		});
		return city;
	},
	async getRemainingDates(parent, args, { userId, query }, info) {
		if (!userId) throw new Error('You must be signed in to access this app.');

		const user = await query.user(
			{ where: { id: userId } },
			`
				{id permissions events {id}}
			`
		);
		// TO DO: define subscription level and benefit!!!
		let datesCount = 5;
		if (user.permissions === 'MONTHLY') datesCount += 3;
		if (user.permissions === 'YEARLY') datesCount += 5;

		return { count: datesCount - user.events.length };
	},
	async invoicesList(parent, args, { userId, user }, info) {
		if (!userId) throw new Error('You must be signed in to access this app.');

		const { data } = await stripe.invoices.list({
			customer: user.stripeCustomerId
		});

		return data;
	},

	async remainingMessages(parent, args, { user, query }, info) {
		const sentMessages = await query.directMessages({
			where: {
				AND: [{ from: { id: user.id } }, { createdAt_gte: moment().startOf('isoWeek') }]
			}
		});

		return 20 - sentMessages.length;
	}
};

module.exports = Query;
