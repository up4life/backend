const moment = require("moment");

module.exports = {
	async createChat(parent, args, { user, db }, info) {
		// User should logged in to create chat
		if (!user) throw new Error("You must be logged in to start a conversation!");

		// FREE users can only send 10 messages per week
		if (user.permissions === "FREE") {
			const sentMessages = await db.prisma.query.directMessages({
				where: {
					AND: [{ from: { id: user.id } }, { createdAt_gte: moment().startOf("isoWeek") }]
				}
			});

			if (sentMessages.length > 20)
				throw new Error("You have reached 20 DMs per week for FREE account.");
		}

		// check to see if chat between users already exists
		let [chat] = await db.prisma.query.chats(
			{
				where: {
					AND: [{ users_some: { id: user.id } }, { users_some: { id: args.id } }]
				}
			},
			info
		);
		if (chat) throw new Error("Conversation between these users already exists");

		// create new chat
		chat = await db.prisma.mutation.createChat(
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
	async sendMessage(parent, { id, message }, { user, db }, info) {
		// User should logged in to create chat
		if (!user) throw new Error("You must be logged in to send a message!");

		// FREE users can only send 20 messages per week
		if (user.permissions === "FREE") {
			const sentMessages = await db.prisma.query.directMessages({
				where: {
					AND: [{ from: { id: user.id } }, { createdAt_gte: moment().startOf("isoWeek") }]
				}
			});

			if (sentMessages.length >= 20)
				throw new Error("You have reached the 20 DM/week free account limit.");
		}

		let [chat] = await db.prisma.query.chats({
			where: {
				AND: [{ users_some: { id: user.id } }, { users_some: { id } }]
			}
		});

		if (!chat) {
			return db.prisma.mutation.createChat(
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
			return db.prisma.mutation.updateChat(
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
	async deleteChat(parent, { id }, { user, db }, info) {
		// simple chat delete to erase entire conversation
		if (!user) throw new Error("You must be logged in to start a conversation!");

		await db.prisma.mutation.deleteChat({
			where: { id }
		});

		return { message: "Chat successfully erased" };
	},
	async updateSeenMessage(parent, { chatId }, { userId, db }, info) {
		let updated = await db.prisma.mutation.updateManyDirectMessages({
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
		return db.prisma.query.chat(
			{
				where: { id: chatId }
			},
			info
		);
	},
	async markAllAsSeen(parent, args, { userId, user, db }, info) {
		if (!user) throw new Error("You must be logged in to start a conversation!");

		const chat = db.prisma.query.chat({
			where: {
				id: args.chatId
			}
		});

		if (!chat) throw new Error("Chat does not exist");

		await db.prisma.mutation.updateManyDirectMessages({
			where: {
				AND: [{ chat: { id: args.chatId } }, { from: { id_not: userId } }, { seen: false }]
			},
			data: {
				seen: true
			}
		});

		return db.prisma.mutation.updateChat({
			where: {
				id: args.chatId
			},
			data: {}
		});
	},
	async toggleTyping(parent, args, { userId, user, db }, info) {
		if (!userId) throw new Error("You must be logged in to toggle typing!");

		const [chat] = await db.prisma.query.chats({
			where: {
				AND: [
					{ id: args.chatId },
					{
						users_some: { id: userId }
					}
				]
			}
		}, `{ typing { id } }`);

		if (!chat) throw new Error("Cannot find chat")

		if (chat.typing.find(user => user.id === userId) && !args.isTyping) {
			return db.prisma.mutation.updateChat({
				where: { id: args.chatId },
				data: {
					typing: {
						disconnect: {
							id: userId
						}
					}
				}
			}, info)
		} else {
			return db.prisma.mutation.updateChat({
				where: { id: args.chatId },
				data: {
					typing: {
						connect: {
							id: userId
						}
					}
				}
			}, info)
		}
	}
};
