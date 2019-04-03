const moment = require('moment');
const axios = require('axios');

// const { prisma } = require('./db');
const botId = process.env.BOT_ID; // need to move the real one to env

module.exports = {
	formatEvents: function(user, eventsArr, ourEvents) {
		return eventsArr.reduce((events, ev) => {
			let existingEvent = events.findIndex(e => e.title === ev.name);
			if (existingEvent !== -1) {
				events[existingEvent].times.push(ev.dates.start.dateTime);
			} else {
				let eventInDb;
				let dbEvent = ourEvents.find(e => e.tmID === ev.id);
				if (dbEvent) {
					const attendees = dbEvent.attending.filter(attendee => {
						if (user.blocked && user.blocked.includes(attendee.id)) return false;
						if (attendee.blocked && attendee.blocked.includes(user.id)) return false;
						if (attendee.id === user.id) return false;

						return (
							moment().diff(user.dob, 'years') <= attendee.maxAgePref &&
							moment().diff(user.dob, 'years') >= attendee.minAgePref &&
							attendee.genderPrefs.includes(user.gender) &&
							moment().diff(attendee.dob, 'years') <= user.maxAgePref &&
							moment().diff(attendee.dob, 'years') >= user.minAgePref &&
							user.genderPrefs.includes(attendee.gender)
						);
					});
					eventInDb = {
						...dbEvent,
						attending: attendees
					};
				}

				const [img] = ev.images.filter(img => img.width > 500);
				events.push({
					id: eventInDb ? eventInDb.id : ev.id,
					tmID: ev.id,
					url: [ev.url],
					title: ev.name,
					city: ev._embedded.venues[0].city.name,
					venue: ev._embedded.venues[0].name,
					image_url: img.url,
					times: ev.dates.start.noSpecificTime
						? [ev.dates.start.localDate]
						: [ev.dates.start.dateTime],
					attending: eventInDb ? eventInDb.attending : [],
					genre: ev.classifications[0].genre ? ev.classifications[0].genre.id : null,
					category: ev.classifications[0].segment && ev.classifications[0].segment.id,
					price: ev.priceRanges
						? {
								min: ev.priceRanges[0].min,
								max: ev.priceRanges[0].max,
								currency: ev.priceRanges[0].currency
						  }
						: null
				});
			}
			return events;
		}, []);
	},
	transformEvents: function(user, eventsArr, prisma) {
		return eventsArr.reduce(async (previousPromise, ev) => {
			let events = await previousPromise;

			let existingEvent = events.findIndex(e => e.title === ev.name);
			if (existingEvent !== -1) {
				events[existingEvent].times.push(ev.dates.start.dateTime);
				events[existingEvent].url.push(ev.url);
			} else {
				let [dbEvent] = await prisma.query.events(
					{
						where: {
							tmID: ev.id
						}
					},
					`{id times attending {id firstName img {id default img_url} dob gender biography minAgePref maxAgePref genderPrefs blocked { id }}}`
				);

				let eventInDb;

				if (dbEvent) {
					const attendees = dbEvent.attending.filter(attendee => {
						if (user.blocked && user.blocked.includes(attendee.id)) return false;
						if (attendee.blocked && attendee.blocked.includes(user.id)) return false;
						if (attendee.id === user.id) return false;

						return (
							moment().diff(user.dob, 'years') <= attendee.maxAgePref &&
							moment().diff(user.dob, 'years') >= attendee.minAgePref &&
							attendee.genderPrefs.includes(user.gender) &&
							moment().diff(attendee.dob, 'years') <= user.maxAgePref &&
							moment().diff(attendee.dob, 'years') >= user.minAgePref &&
							user.genderPrefs.includes(attendee.gender)
						);
					});

					eventInDb = {
						...dbEvent,
						attending: attendees
					};
				}

				const [img] = ev.images.filter(img => img.width > 500);

				events.push({
					id: eventInDb ? eventInDb.id : ev.id,
					tmID: ev.id,
					url: [ev.url],
					title: ev.name,
					city: ev._embedded.venues[0].city.name,
					venue: ev._embedded.venues[0].name,
					image_url: img.url,
					times: ev.dates.start.noSpecificTime
						? [ev.dates.start.localDate]
						: [ev.dates.start.dateTime],
					attending: eventInDb ? eventInDb.attending : [],
					genre: ev.classifications[0].genre ? ev.classifications[0].genre.id : null,
					category: ev.classifications[0].segment && ev.classifications[0].segment.id,
					price: ev.priceRanges
						? {
								min: ev.priceRanges[0].min,
								max: ev.priceRanges[0].max,
								currency: ev.priceRanges[0].currency
						  }
						: null
				});
			}

			return events;
		}, Promise.resolve([]));
	},
	setDates: function(dates) {
		let start, end;
		switch (dates) {
			case 'this week':
			case 'this week,this weekend':
				start = moment()
					.startOf('isoWeek')
					.format();
				end = moment()
					.endOf('isoWeek')
					.format();
				break;
			case 'this week,this weekend,next week':
			case 'this week,next week':
				start = moment()
					.startOf('isoWeek')
					.format();
				end = moment()
					.add(1, 'weeks')
					.endOf('isoWeek')
					.format();
				break;
			case 'this weekend,next week':
				start = moment()
					.endOf('isoWeek')
					.subtract(3, 'days')
					.format();
				end = moment()
					.add(1, 'weeks')
					.endOf('isoWeek')
					.format();
				break;
			case 'this weekend':
				start = moment()
					.endOf('isoWeek')
					.subtract(3, 'days')
					.format();
				end = moment()
					.endOf('isoWeek')
					.format();
				break;
			case 'next week':
				start = moment()
					.add(1, 'weeks')
					.startOf('isoWeek')
					.format();
				end = moment()
					.add(1, 'weeks')
					.endOf('isoWeek')
					.format();
				break;
			default:
				start = moment(dates)
					.add(1, 'day')
					.startOf('day')
					.format();
				end = moment(dates)
					.add(1, 'day')
					.endOf('day')
					.format();
				break;
		}
		return { start, end };
	},
	checkDates: function(dates, events) {
		let date, start, end, filteredEvents;
		switch (dates.toLowerCase()) {
			case 'all':
				return events;
			case 'today':
				date = moment().format('YYYY-MM-DD');
				return events.filter(ev => ev.times.some(t => moment(t).format('YYYY-MM-DD') === date));
			case 'this weekend':
				start = moment()
					.endOf('isoWeek')
					.subtract(2, 'days')
					.format('YYYY-MM-DD');
				end = moment()
					.endOf('isoWeek')
					.format('YYYY-MM-DD');
				return events.filter(ev =>
					ev.times.some(
						t => moment(t).format('YYYY-MM-DD') >= start && moment(t).format('YYYY-MM-DD') <= end
					)
				);
			case 'next week':
				start = moment()
					.add(1, 'weeks')
					.startOf('isoWeek')
					.format('YYYY-MM-DD');
				end = moment()
					.add(1, 'weeks')
					.endOf('isoWeek')
					.format('YYYY-MM-DD');
				return events.filter(ev =>
					ev.times.some(
						t => moment(t).format('YYYY-MM-DD') >= start && moment(t).format('YYYY-MM-DD') <= end
					)
				);
			default:
				date = moment(`${moment().format('YYYY')} ${dates}`, 'YYYY MMM DD').format('YYYY-MM-DD');
				return events.filter(ev => ev.times.some(t => moment(t).format('YYYY-MM-DD') === date));
		}
	},
	fetchEvents: function(geoHash, cats, dates, page, size, genres) {
		if (dates) {
			if (genres && genres.length) {
				return axios.get(
					`https://app.ticketmaster.com/discovery/v2/events.json?size=${size}&page=${page}&startDateTime=${
						dates.start
					}&endDateTime=${
						dates.end
					}&classificationId=${cats}&genreId=${genres}&city=${geoHash}&apikey=${
						process.env.TKTMSTR_KEY
					}`
				);
			}
			return axios.get(
				`https://app.ticketmaster.com/discovery/v2/events.json?size=${size}&page=${page}&startDateTime=${
					dates.start
				}&endDateTime=${dates.end}&classificationId=${cats}&city=${geoHash}&apikey=${
					process.env.TKTMSTR_KEY
				}`
			);
		}
		if (genres && genres.length) {
			return axios.get(
				`https://app.ticketmaster.com/discovery/v2/events.json?size=${size}&page=${page}&startDateTime=${moment().format()}&classificationId=${cats}&genreId=${genres}&city=${geoHash}&apikey=${
					process.env.TKTMSTR_KEY
				}`
			);
		}
		return axios.get(
			`https://app.ticketmaster.com/discovery/v2/events.json?size=${size}&page=${page}&startDateTime=${moment().format()}&classificationId=${cats}&city=${geoHash}&apikey=${
				process.env.TKTMSTR_KEY
			}`
		);
	},
	getEventImages: function(id) {
		return axios.get(
			`https://app.ticketmaster.com/discovery/v2/events/${id}/images.json?apikey=${
				process.env.TKTMSTR_KEY
			}`
		);
	},
	fetchInitialEvents: function(location, genres, page) {
		return axios.get(
			`https://app.ticketmaster.com/discovery/v2/events.json?size=100&page=${page}&genreId=${genres}&city=${location}&apikey=${
				process.env.TKTMSTR_KEY
			}`
		);
	},
	async getUser(ctx) {
		const Authorization = ctx.req.get('Authorization');
		if (Authorization) {
			const token = Authorization.replace('Bearer ', '');
			const { id, admin } = await verifyUserSessionToken(token);
			return { id, admin };
		}
		return null;
	},

	async getScore(currentUserId, matchingUserId, query) {
		// events that both users have in common
		const sharedEvents = await query.events({
			where: {
				AND: [
					{
						attending_some: {
							id: currentUserId
						}
					},
					{
						attending_some: {
							id: matchingUserId
						}
					}
				]
			}
		});

		// calculate eventScore giving 10 max points
		let eventScore = Math.floor(Math.log2(3.5 * sharedEvents.length + 1) * 1000);
		eventScore = eventScore > 5000 ? 5000 : eventScore;

		// query current user events genre and current user interests
		const currentUser = await query.users(
			{
				where: {
					id: currentUserId
				}
			},
			`{ events { id genre } interests { id } }`
		);

		// get unique genre list for current user
		const currentUserGenres = currentUser[0].events.reduce((genres, event) => {
			if (event.genre && !genres.includes(event.genre)) {
				genres.push(event.genre);
			}
			return genres;
		}, []);

		// query matching user events genre and matching user interests
		const matchingUser = await query.users(
			{
				where: {
					id: matchingUserId
				}
			},
			`{ events { genre } interests { id } }`
		);

		// get unique genre list for matching user
		const matchingUserGenres = matchingUser[0].events.reduce((genres, event) => {
			if (event.genre && !matchingUser.includes(event.genre)) {
				genres.push(event.genre);
			}
			return genres;
		}, []);

		// get shared genres between the two users
		const sharedGenre = currentUserGenres.reduce((count, genre) => {
			if (matchingUserGenres.includes(genre)) count++;
			return count;
		}, 0);

		// calculate genreScore giving 5 max points
		const genreScore = sharedGenre < 5 ? sharedGenre : 5;

		// get shared interest between the two users
		const sharedInterest = currentUser[0].interests.reduce((shared, interest) => {
			if (matchingUser[0].interests.find(i => i.id === interest.id)) shared.push(interest);
			return shared;
		}, []);

		// calculate interestScore giving 5 max point
		let interestScore = Math.floor(Math.log2(3 * sharedInterest.length + 1) * 1000);
		interestScore = interestScore > 5000 ? 5000 : interestScore;

		// compatibility score is the sum of eventScore, genreScore, and interestScore
		const score = eventScore + 0 * genreScore + interestScore;
		return score;
	},

	async botMessage(toUserId, { query, mutation }, msgType = 'REGISTRATION', args) {
		let text;

		switch (msgType) {
			case 'SUBSCRIPTION':
				if (args.type === 'MONTHLY') {
					text =
						'Congrats and welcome aboard! Now you can enjoy unlimited chat privileges, event saving and more!';
				} else {
					text =
						'Congrats and welcome aboard! Now you can enjoy unlimited chat privileges, event saving and more!';
				}
				break;
			case 'UNSUBSCRIBE':
				text = `Parting is such sweet sorrow...Don't worry. If you change your mind everything in your account will be right where you left it. But we'll miss you.`;
				break;
			case 'EVENT_LIMIT':
				text = `Ruh - roh, looks like you're out of events for now. Try one of our premium accounts and save as many events as you like!`;
				break;
			case 'CHAT_LIMIT':
				text = `Gahh!  We're out of messages for now. Try one of our premium accounts and get unlimited chat access!`;
				break;
			default:
				text = `Welcome To Up4!  This is the chat pane.  You can find and reply to all your private messages here as well as navigate to your chat hub.  As a free user you event saving and chats are limited but you can still see everything that's going on near you.Have fun!`;
		}

		let [chat] = await query.chats({
			where: {
				AND: [{ users_some: { id: toUserId } }, { users_some: { id: botId } }]
			}
		});

		if (!chat) {
			await mutation.createChat({
				data: {
					users: { connect: [{ id: toUserId }, { id: botId }] },
					messages: {
						create: [
							{
								text,
								from: { connect: { id: botId } },
								to: { connect: { id: toUserId } }
							}
						]
					}
				}
			});
		} else {
			await mutation.updateChat({
				where: {
					id: chat.id
				},
				data: {
					messages: {
						create: [
							{
								text,
								from: { connect: { id: botId } },
								to: { connect: { id: toUserId } }
							}
						]
					}
				}
			});
		}
	}
};
