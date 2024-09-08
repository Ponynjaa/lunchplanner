import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

export const getLocationByAddress = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { query, countryCode } = req.query;

		// TODO: may add a cache and some kind of protection so this doesn't get abused
		const response = await axios.get(`https://api.mapbox.com/search/geocode/v6/forward?q=${query}&country=${countryCode}&types=address&access_token=${process.env.MAPBOX_TOKEN}`);
		const suggestions = response.data.features.map((feature: any) => {
			return {
				id: feature.id,
				full_address: feature.properties.full_address,
				name: feature.properties.name,
				postalCode: feature.properties.context.postcode.name,
				place: feature.properties.context.place.name,
				address: feature.properties.context.address.name,
				street: feature.properties.context.address.street_name,
				address_number: feature.properties.context.address.address_number,
				longitude: feature.properties.coordinates.longitude,
				latitude: feature.properties.coordinates.latitude
			};
		});

		res.status(200).json(suggestions);
	} catch (err) {
		next(err);
		res.status(400).send(err);
	}
}
