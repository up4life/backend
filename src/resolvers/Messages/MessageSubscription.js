module.exports = {
	myChat: {
		subscribe(parent, { id }, { db }, info) {
			return db.prisma.subscription.chat(
				{
					where: {
						AND: [
							{
								mutation_in: ["CREATED", "UPDATED", "DELETED"]
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
		async subscribe(parent, { id }, { db }, info) {
			return db.prisma.subscription.directMessage(
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
		async subscribe(parent, { chatId }, { db }, info) {
			return db.prisma.subscription.directMessage(
				{
					where: {
						node: {
							chat: {
								id: chatId
							}
						}
					}
				},
				info
			);
		}
	}
};
