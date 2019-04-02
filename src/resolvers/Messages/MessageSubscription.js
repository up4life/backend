module.exports = {
	myChat: {
		subscribe(parent, { id }, { subscription }, info) {
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
										id
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
		async subscribe(parent, { id }, { subscription }, info) {
			return subscription.directMessage(
				{
					where: {
						node: {
							chat: {
								users_some: {
									id
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
		async subscribe(parent, { chatId }, { subscription }, info) {
			return subscription.chat(
				{
					where: {
						node: {
							id: chatId
						}
					}
				},
				info
			);
		}
	}
};
