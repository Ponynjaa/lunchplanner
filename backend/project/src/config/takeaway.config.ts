import { Takeaway, TakeawayConfig } from "takeaway";

const config = new TakeawayConfig({
	language: 'de',
	url: 'https://de.citymeal.com/android/android.php',
	appVersion: '9999.9999.9999'
});

// initialize Takeaway API
export const takeaway = new Takeaway(config);
