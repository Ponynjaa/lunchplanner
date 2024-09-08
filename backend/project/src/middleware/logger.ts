import winston from 'winston';

const logger = winston.createLogger({
	level: 'error',
	transports: [
		new winston.transports.File({ filename: 'error.log', level: 'error' }),
		new winston.transports.Console({ level: 'debug' })
	]
});

export default logger;
