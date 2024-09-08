import { WebSocket, WebSocketServer, MessageEvent } from 'ws';
import { Request, NextFunction } from 'express';
import http from 'http';
import { keycloak } from './keycloak.config.js';

type Sessions = {
	[sessionId: number]: Set<WebSocket>;
};

export class WebSocketConfiguration {
	wss: WebSocketServer;
	sessions: Sessions;

	constructor(server: http.Server) {
		this.wss = new WebSocketServer({ server });
		this.sessions = {};

		this.wss.on('connection', this.onConnection);
	}

	async authenticate(ws: WebSocket, req: http.IncomingMessage, next: NextFunction) {
		const token = req.url?.match(/^\/\?token=(.*)/)?.[1];
		if (!token) {
			ws.close(4001, 'Unauthorized');
			return;
		}

		try {
			// have to stringify this since keycloak messed up the typings, access_token has to be a string here (when using the object directly instead of stringifying it)!
			await keycloak.grantManager.createGrant(JSON.stringify({ access_token: token }));
			next();
		} catch (error) {
			next(error);
		}
	}

	onConnection = (ws: WebSocket, req: Request) => {
		this.authenticate(ws, req, (err) => {
			if (err) {
				console.log('Websocket connection rejected: ', err);
				ws.close(4001, 'Unauthorized');
				return;
			}

			ws.once('message', (data) => {
				const parsedData = JSON.parse(data.toString());
				console.log(parsedData);
				const sessionId = parseInt(parsedData.subscribe);
				this.registerClient(ws, sessionId);

				ws.on('message', (msg) => {
					console.log(`In session ${sessionId} following msg was received: ${msg.toString()}`);
					this.onMessage(sessionId, JSON.parse(msg.toString()));
				});

				ws.on('close', () => {
					this.unregisterClient(ws, sessionId);
				});
			});
		});
	}

	onMessage(sessionId: number, msg: any) {
		// TODO: do upvote/downvote stuff here ._.
	}

	registerClient(ws: WebSocket, sessionId: number) {
		if (!this.sessions[sessionId]) {
			this.sessions[sessionId] = new Set<WebSocket>();
		}

		this.sessions[sessionId].add(ws);
	}

	unregisterClient(ws: WebSocket, sessionId: number) {
		if (!this.sessions[sessionId]) {
			return;
		}

		this.sessions[sessionId].delete(ws);
		if (this.sessions[sessionId].size === 0) {
			delete this.sessions[sessionId];
		}
	}

	sendMessage(sessionId: number, msg: any) {
		if (!this.sessions[sessionId]) {
			return;
		}

		for (const client of this.sessions[sessionId]) {
			client.send(JSON.stringify(msg));
		}
	}
}
