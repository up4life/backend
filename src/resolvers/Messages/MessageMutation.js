const moment = require('moment');

module.exports = {
	async createChat(parent, args, { user, query, mutation }, info) {
		// User should logged in to create chat
		if (!user) throw new Error('You must be logged in to start a conversation!');

		// FREE users can only send 10 messages per week
		if (user.permissions === 'FREE') {
			const sentMessages = await query.directMessages({
				where: {
					AND: [{ from: { id: user.id } }, { createdAt_gte: moment().startOf('isoWeek') }]
				}
			});

			if (sentMessages.length > 20)
				throw new Error('You have reached 20 DMs per week for FREE account.');
		}

		// GONNA TRY AND SEE IF THIS IS NECESSARY OR NOT (METHINKS NOT)

		// check to see if chat between users already exists
		// let [chat] = await query.chats(
		// 	{
		// 		where: {
		// 			AND: [{ users_some: { id: user.id } }, { users_some: { id: args.id } }]
		// 		}
		// 	},
		// 	info
		// );
		// if (chat) throw new Error('Conversation between these users already exists');

		// create new chat
		const chat = await mutation.createChat(
			{
				data: {
					users: {
						connect: [{ id: user.id }, { id: args.id }]
					},
					messages: {
						create: [{ text: args.message, from: { connect: { id: user.id } } }]
					}
				}
			},
			info
		);

		return chat;
	},
	async sendMessage(parent, { id, message }, { user, query, mutation }, info) {
		// User should logged in to create chat
		if (!user) throw new Error('You must be logged in to send a message!');

		// FREE users can only send 20 messages per week
		if (user.permissions === 'FREE') {
			const sentMessages = await query.directMessages({
				where: {
					AND: [{ from: { id: user.id } }, { createdAt_gte: moment().startOf('isoWeek') }]
				}
			});

			if (sentMessages.length >= 20)
				throw new Error('You have reached the 20 DM/week free account limit.');
		}

		let [chat] = await query.chats({
			where: {
				AND: [{ users_some: { id: user.id } }, { users_some: { id } }]
			}
		});

		if (!chat) {
			return mutation.createChat(
				{
					data: {
						users: { connect: [{ id: user.id }, { id }] },
						messages: {
							create: [
								{
									text: message,
									from: { connect: { id: user.id } },
									to: { connect: { id } }
								}
							]
						}
					}
				},
				info
			);
		} else {
			return mutation.updateChat(
				{
					where: {
						id: chat.id
					},
					data: {
						messages: {
							create: [
								{
									text: message,
									from: { connect: { id: user.id } },
									to: { connect: { id } }
								}
							]
						}
					}
				},
				info
			);
		}
	},
	async deleteChat(parent, { id }, { user, mutation }, info) {
		if (!user) throw new Error('You must be logged in to start a conversation!');

		await mutation.deleteChat({
			where: { id }
		});

		return { message: 'Chat successfully erased' };
	},
	async updateSeenMessage(parent, { chatId }, { userId, query, mutation }, info) {
		let updated = await mutation.updateManyDirectMessages({
			where: {
				chat: {
					id: chatId
				},
				seen: false,
				from: {
					id_not: userId
				}
			},
			data: {
				seen: true
			}
		});
		return query.chat(
			{
				where: { id: chatId }
			},
			info
		);
	},
	async markAllAsSeen(parent, { chatId }, { user, query, mutation }, info) {
		if (!user) throw new Error('You must be logged in to start a conversation!');

		const chat = query.chat({
			where: {
				id: chatId
			}
		});

		if (!chat) throw new Error('Chat does not exist');

		await mutation.updateManyDirectMessages({
			where: {
				AND: [{ chat: { id: chatId } }, { from: { id_not: user.id } }, { seen: false }]
			},
			data: {
				seen: true
			}
		});

		return mutation.updateChat({
			where: {
				id: chatId
			},
			data: {}
		});
	},
	async toggleTyping(parent, { chatId, isTyping }, { userId, query, mutation }, info) {
		if (!userId) throw new Error('You must be logged in to toggle typing!');

		const [chat] = await query.chats(
			{
				where: {
					AND: [
						{ id: chatId },
						{
							users_some: { id: userId }
						}
					]
				}
			},
			`{ typing { id } }`
		);

		if (!chat) throw new Error('Cannot find chat');
		if (!isTyping && chat.typing.find(user => user.id === userId)) {
			return mutation.updateChat(
				{
					where: { id: chatId },
					data: {
						typing: {
							disconnect: {
								id: userId
							}
						}
					}
				},
				info
			);
		} else if (isTyping) {
			return mutation.updateChat(
				{
					where: { id: chatId },
					data: {
						typing: {
							connect: {
								id: userId
							}
						}
					}
				},
				info
			);
		} else {
			return query.chat(
				{
					where: { id: chatId }
				},
				info
			);
		}
	}
};
