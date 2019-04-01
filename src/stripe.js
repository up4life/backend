const stripe = require('stripe')(process.env.STRIPE_SECRET);

const getProduct = async () => {
	const product = await stripe.products.create({
		name: 'Up4',
		type: 'service',
	});
	console.log(product);
};

// only need to run this once.
// getProduct()

const createPlan = async (name, interval, amount) => {
	const plan = await stripe.plans.create({
		// product: 'prod_EnmdNIvok3JOk2',
		// product: 'prod_Eno6M8G6y4gbr3',
		product: 'prod_Enp6VhVj6lPWfC',
		nickname: name,
		currency: 'usd',
		interval,
		amount: amount,
	});
	console.log(plan);
};

// only need to run this once.
// createPlan('UP4 Monthly Plan', 'month', 499);
// createPlan('UP4 Yearly Plan', 'year', 2999);

module.exports = stripe;
