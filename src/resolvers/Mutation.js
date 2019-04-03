const authy = require('authy')(process.env.AUTHY_KEY);
const { forwardTo } = require('prisma-binding');
const { randomBytes } = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { createUserToken, verifyIdToken, getUserRecord } = require('../firebase/firebase');
const MessageMutation = require('./Messages/MessageMutation');
const { transport, formatEmail } = require('../mail');
const UserMutation = require('./User/UserMutation');
const { botMessage } = require('../utils');
const stripe = require('../stripe');

const Mutation = {
	...MessageMutation,
	...UserMutation,
	deleteManyGenres: forwardTo('prisma'),

	async signup(parent, args, { query, mutation, res }, info) {
		args.email = args.email.toLowerCase();
		if (!/^(?=.*\d).{8,}$/.test(args.password)) {
			throw new Error('Password must be 8 characters with at least 1 number!');
		}

		const password = await bcrypt.hash(args.password, 10);
		const user = await mutation.createUser(
			{
				data: {
					...args,
					password,
					permissions: 'FREE', // default permission for user is FREE tier
					img: {
						create: {
							img_url:
								'https://res.cloudinary.com/dcwn6afsq/image/upload/v1552598409/up4/autftv4fj3l7qlkkt56j.jpg', // default avatar img if none provided
							default: true
						}
					}
				}
			},
			info
		);

		// UP4-bot welcome message
		await botMessage(user.id, { query, mutation });

		const token = await jwt.sign({ userId: user.id }, process.env.APP_SECRET);

		res.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});

		return user;
	},
	async firebaseAuth(parent, args, ctx, info) {
		const { query, mutation, res } = ctx;

		const { uid } = await verifyIdToken(args.idToken);
		const { providerData } = await getUserRecord(uid);

		console.log(uid, 'uid firebaseAuth');

		const { email, displayName, photoURL, phoneNumber } = providerData[0];

		let newUser = false;
		let user = await query.user({ where: { email } });

		console.log(user, 'user');
		if (!user) {
			let nameArray = displayName.split(' ');
			newUser = true;
			user = await mutation.createUser(
				{
					data: {
						firstName: nameArray[0],
						lastName: nameArray[1] || '',
						email,
						password: 'firebaseAuth',
						img: {
							create: {
								img_url: photoURL
									? photoURL
									: 'https://res.cloudinary.com/dcwn6afsq/image/upload/v1552598409/up4/autftv4fj3l7qlkkt56j.jpg',
								default: true
							}
						},
						phone: phoneNumber || null,
						permissions: 'FREE'
					}
				},
				`{id firstName email}`
			);

			// UP4-bot welcome message
			await botMessage(user.id, { query, mutation });
			// await setUserClaims(uid, { id: user.id, admin: false });
		}
		const session = await createUserToken(args, ctx);

		const token = await jwt.sign({ userId: user.id }, process.env.APP_SECRET);

		res.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});

		return { token, user, newUser };
	},
	async signin(parent, { email, password }, { query, res }, info) {
		const user = await query.user({ where: { email } });

		if (!user) {
			throw new Error(`No such user found for email ${email}`);
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			throw new Error('Invalid Password!');
		}

		const token = await jwt.sign({ userId: user.id }, process.env.APP_SECRET);

		res.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year long cookie bc why not. FIGHT ME
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});

		return user;
	},
	signout(parent, args, { res }, info) {
		res.clearCookie('token', {
			httpOnly: true,
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});
		res.clearCookie('session', {
			httpOnly: true,
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});

		return { message: 'Goodbye!' };
	},
	async requestReset(parent, { email }, { query, mutation }, info) {
		const user = await query.user({ where: { email } });
		if (!user) {
			throw new Error(`No such user found for email ${email}`);
		}
		// get a random string of numbers/letters then make it hex
		const random = await randomBytes(20);

		const resetToken = random.toString('hex');
		const resetTokenExpiry = Date.now() + 3600000; // 1 hr
		const res = mutation.updateUser({
			where: { email },
			data: { resetToken, resetTokenExpiry }
		});
		// console.log(res, resetToken); // check things are set correctly
		const mailRes = await transport.sendMail({
			from: 'support@up4.life',
			to: user.email,
			subject: 'Your Password Reset Token',
			html: formatEmail(`Your Password Reset Token is here!
		  \n\n
		  <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`)
		});

		return { message: 'Thanks!' };
	},
	async updateDefaultImage(parent, { id }, { user, mutation }, info) {
		if (!user) throw new Error('You must be logged in!');

		return mutation.updateUser(
			{
				where: {
					id: user.id
				},
				data: {
					img: {
						update: [
							{
								where: {
									id
								},
								data: {
									default: true
								}
							}
						],
						updateMany: [
							{
								where: {
									id_not: id
								},
								data: {
									default: false
								}
							}
						]
					}
				}
			},
			info
		);
	},

	async updateLocation(parent, { city }, { mutation, user }, info) {
		if (!user) throw new Error('You must be logged in!');

		return mutation.updateUser(
			{
				where: {
					id: user.id
				},
				data: {
					location: city
				}
			},
			info
		);
	},
	async resetPassword(parent, args, { query, mutation, res }, info) {
		if (args.password !== args.confirmPassword) {
			throw new Error('Passwords must match!');
		}
		const [user] = await query.users({
			where: {
				resetToken: args.resetToken,
				resetTokenExpiry_gte: Date.now() - 3600000 // make sure token is within 1hr limit
			}
		});
		if (!user) throw new Error('This token is either invalid or expired');

		const password = await bcrypt.hash(args.password, 10);
		// removed token and expiry fields from user once updated
		const updatedUser = await mutation.updateUser({
			where: { email: user.email },
			data: {
				password,
				resetToken: null,
				resetTokenExpiry: null
			}
		});
		const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

		res.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365,
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});
		return updatedUser;
	},
	async createOrder(parent, args, { user, query, mutation }, info) {
		if (!user) throw new Error('You must be signed in to complete this order.');

		// Check user's subscription status
		if (user.permissions === args.subscription) {
			throw new Error(`User already has ${args.subscription} subscription`);
		}

		// Create new stripe customer if user is not one already
		let customer;
		try {
			customer = await stripe.customers.retrieve(user.stripeCustomerId);
		} catch {
			customer = await stripe.customers.create({
				email: user.email,
				source: args.token
			});
		}

		// Create a subscription
		const subscription = await stripe.subscriptions.create({
			customer: customer.id,
			items: [
				{
					plan:
						args.subscription === 'MONTHLY' ? process.env.STRIPE_MONTHLY : process.env.STRIPE_YEARLY
				}
			]
		});

		// Update user's permission type
		mutation.updateUser({
			data: {
				permissions: args.subscription,
				stripeSubscriptionId: subscription ? subscription.id : user.stripeSubscriptionId,
				stripeCustomerId: customer ? customer.id : user.stripeCustomerId
			},
			where: {
				id: user.id
			}
		});

		// UP4-bot thank you note
		await botMessage(user.id, { query, mutation }, 'SUBSCRIPTION', { type: args.subscription });

		return {
			message: 'Thank You'
		};
	},
	async cancelSubscription(parent, args, { user, query, mutation }, info) {
		// Check user's login status
		if (!user) throw new Error('You must be signed in to complete this order.');

		if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
			throw new Error('User has no stripe customer Id or subscription Id');
		}

		try {
			await stripe.subscriptions.del(user.stripeSubscriptionId, {
				invoice_now: true,
				prorate: true
			});
		} catch {
			console.log('old subscription');
		}

		// UP4-bot sad note
		await botMessage(user.id, { query, mutation }, 'UNSUBSCRIBE');

		// Update user's permission type
		return mutation.updateUser(
			{
				data: {
					permissions: 'FREE',
					stripeSubscriptionId: null
				},
				where: {
					id: user.id
				}
			},
			info
		);
	},
	async internalPasswordReset(parent, args, { user, res, mutation }, info) {
		if (args.newPassword1 !== args.newPassword2) {
			throw new Error('New passwords must match!');
		}
		if (!user) {
			throw new Error('You must be logged in!');
		}
		// compare oldpassword to password from user object
		const samePassword = await bcrypt.compare(args.oldPassword, user.password);
		if (!samePassword) throw new Error('Incorrect password, please try again.');
		const newPassword = await bcrypt.hash(args.newPassword1, 10);

		// update password
		const updatedUser = await mutation.updateUser({
			where: { id: user.id },
			data: {
				password: newPassword
			}
		});
		const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

		res.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365,
			domain: process.env.NODE_ENV === 'development' ? 'localhost' : 'up4.life'
		});
		return updatedUser;
	},
	async addEvent(parent, { event }, { user, query, mutation }, info) {
		if (!user) throw new Error('You must be signed in to add an event.');

		if (user.permissions === 'FREE' && user.events.length >= 10) {
			throw new Error('You have reached maximum saved events for FREE account.');
		}

		if (user.permissions === 'FREE' && user.events.length == 9) {
			// UP4-bot error message
			await botMessage(user.id, { query, mutation }, 'EVENT_LIMIT');
		}

		const [existingEvent] = await query.events({
			where: {
				tmID: event.tmID
			}
		});
		let eventId = -1;
		if (existingEvent) {
			eventId = existingEvent.id;

			const [alreadySaved] = user.events.filter(ev => ev.id === eventId);
			if (alreadySaved) {
				throw new Error("You've already saved that event!");
			}
		}

		return mutation.upsertEvent(
			{
				where: {
					id: eventId
				},
				update: {
					attending: {
						connect: {
							id: user.id
						}
					}
				},
				create: {
					title: event.title,
					tmID: event.tmID,
					venue: event.venue,
					times: { set: event.times },
					image_url: event.image_url,
					genre: event.genre,
					category: event.category,
					city: event.city,
					attending: {
						connect: {
							id: user.id
						}
					}
				}
			},
			info
		);
	},
	async deleteEvent(parent, { eventId }, { user, query, mutation }, info) {
		if (!user) throw new Error('You must be signed in to add delete an event.');

		const updatedUser = await mutation.updateUser({
			where: { id: user.id },
			data: {
				events: {
					disconnect: {
						id: eventId // remove event from user's and remove user from attending
					}
				}
			},
			info
		});

		const event = await query.event({ where: { id: eventId } }, `{attending {id}}`);
		if (event.attending.length === 0) {
			await mutation.deleteEvent({ where: { id: eventId } });
		}

		return updatedUser;
	},
	async updateUser(parent, { data }, { user, mutation }, info) {
		if (!user) throw new Error('You must be logged in to update your profile!');

		const updated = await mutation.updateUser(
			{
				where: { id: user.id },
				data: { ...data }
			},
			info
		);

		return updated;
	},
	async verifyPhone(parent, { phone }, { user, mutation }, info) {
		if (!user) throw new Error('You must be logged in to update your profile!');

		await mutation.updateUser({
			where: { id: user.id },
			data: { phone }
		});

		authy.phones().verification_start(phone, '1', 'sms', (err, res) => {
			if (err) {
				console.log(err);
				throw new Error(err);
			}
			return { message: 'Phone verification code sent!' };
		});
	},
	async checkVerify(parent, { phone, code }, { user, mutation }, info) {
		if (!user) throw new Error('You must be logged in to update your profile!');

		authy.phones().verification_check(phone, '1', code, async (err, res) => {
			if (err) {
				throw new Error('Phone verification unsuccessful');
			}
			await mutation.updateUser({
				where: { id: user.id },
				data: { verified: true }
			});
			return { message: 'Phone successfully verified!' };
		});
	},
	async deleteUser(parent, args, { user, mutation }, info) {
		await mutation.deleteUser({
			where: {
				id: args.id
			}
		});
		return { message: 'User deleted' };
	},
	async uploadImage(parent, { url }, { user, mutation }, info) {
		let res = await mutation.createProfilePic(
			{
				data: {
					default: true,
					img_url: url,
					user: { connect: { id: user.id } }
				}
			},
			`{id}`
		);
		return mutation.updateUser(
			{
				where: { id: user.id },
				data: {
					img: {
						updateMany: [{ where: { id_not: res.id }, data: { default: false } }]
					}
				}
			},
			info
		);
	}
};

module.exports = Mutation;

// this is the SMTP Holden has setup that we can use to send emails once we go into production (have a hard cap of 100 emails/month though)
// const mailRes = await client.sendEmail({
// 	From: 'support@up4.life',
// 	To: `${user.email}`,
// 	Subject: 'Your Password Reset Token!',
// 	HtmlBody: makeANiceEmail(`Your Password Reset Token is here!
//   \n\n
//   <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`)
// });
