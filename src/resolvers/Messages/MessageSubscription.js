module.exports = {
	myChat: {
		subscribe(parent, args, { subscription, userId }, info) {
			console.log(userId, 'userId inside subs');
			// if (!userId) throw new Error('You gotta be logged in for that!');

			return subscription.chat(
				{
					where: {
						AND: [
							{
								mutation_in: ['CREATED', 'UPDATED', 'DELETED']
							},
							{
								node: {
									users_some: {
										id: userId
									}
								}
							}
						]
					}
				},
				info
			);
		}
	},
	myMessages: {
		async subscribe(parent, args, { subscription, userId }, info) {
			console.log(userId, 'userId inside subs');
			// if (!userId) throw new Error('You gotta be logged in for that!');

			return subscription.directMessage(
				{
					where: {
						node: {
							chat: {
								users_some: {
									id: userId
								}
							}
						}
					}
				},
				info
			);
		}
	},
	myMessage: {
		async subscribe(parent, args, { subscription, userId }, info) {
			console.log(userId, 'userId inside subs');
			// if (!userId) throw new Error('You gotta be logged in for that!');

			return subscription.chat(
				{
					where: {
						node: {
							id: args.chatId
						}
					}
				},
				info
			);
		}
	}
};
