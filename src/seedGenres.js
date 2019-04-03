const { prisma } = require('./db');
const genres = require('./genres');

const seed = async () => {
	Promise.all(
		genres.map(async genre => {
			try {
				const response = await prisma.mutation.createGenre({
					data: {
						...genre
					}
				});
				return response;
			} catch (err) {
				throw new Error(err.message);
			}
		})
	).catch(e => console.log(e));
};

seed();
