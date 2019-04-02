const moment = require('moment');

module.exports = {
	getChat(parent, { id }, { user, query }, info) {
		// this is to find a specific chat by id
		if (!user) throw new Error('You must be logged in to start a conversation!');

		return query.chat(
			{
				where: {
					id
				}
			},
			info
		);
	},
	getUserChats(parent, args, { user, query }, info) {
		if (!user) throw new Error('You must be logged in to start a conversation!');

		// this gets all of the chats that involve the currentUser
		return query.chats(
			{
				where: {
					users_some: { id: user.id }
				}
			},
			info
		);
	},
	async getMessages(parent, args, { user, query }, info) {
		if (!user) throw new Error('You must be logged in to start a conversation!');

		return query.chats(
			{
				where: {
					users_some: { id: user.id }
				}
			},
			`{messages {id text createdAt seen from { id firstName img {img_url default} dob gender}}}`
		);
	},
	async getConversation(parent, { id }, { user, query }, info) {
		if (!user) throw new Error('You must be logged in to start a conversation!');

		// this is to check if there is already a convo between logged in user and someone else
		const [chat] = await query.chats(
			{
				where: {
					AND: [{ users_some: { id: user.id } }, { users_some: { id } }]
				}
			},
			info
		);

		return chat;
	},
	async getMessageLeft(parent, args, { user, query }, info) {
		if (!user) throw new Error('You must be logged in to start a conversation!');

		if (user.permissions !== 'FREE') return 1000;

		const sentMessages = await query.directMessages({
			where: {
				AND: [{ from: { id: user.id } }, { createdAt_gte: moment().startOf('isoWeek') }]
			}
		});

		return 20 - sentMessages.length;
	}
};
