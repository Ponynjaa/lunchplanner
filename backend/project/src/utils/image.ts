import { createCanvas } from 'canvas';

export const createImage = (text: string, backgroundColor?: string, foregroundColor?: string) => {
	if (!backgroundColor || !foregroundColor) {
		const bgColor = getRandomColor();
		backgroundColor = rgbToHex(bgColor.r, bgColor.g, bgColor.b);

		const luminance = getLuminance(bgColor.r, bgColor.g, bgColor.b);
		foregroundColor = luminance > 0.5 ? '#000000' : '#FFFFFF';
	}

	const canvas = createCanvas(200, 200);
	const context = canvas.getContext('2d');

	context.fillStyle = backgroundColor;
	context.fillRect(0, 0, canvas.width, canvas.height);

	context.font = "bold 100px Assistant";
	context.fillStyle = foregroundColor;
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, canvas.width / 2, canvas.height / 2);

	return canvas.toBuffer('image/png');
}

export const getRandomColor = () => {
	const r = Math.floor(Math.random() * 256);
	const g = Math.floor(Math.random() * 256);
	const b = Math.floor(Math.random() * 256);
	return { r, g, b };
}

export const rgbToHex = (r: number, g: number, b: number) => {
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export const getLuminance = (r: number, g: number, b: number) => {
	// Convert to sRGB
	r = r / 255;
	g = g / 255;
	b = b / 255;

	// Apply gamma correction
	r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
	g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
	b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

	// Calculate luminance
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
