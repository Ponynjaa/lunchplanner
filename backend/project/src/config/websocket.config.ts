import { WebSocketServer } from 'ws';
import http from 'http';

export class WebSocketConfiguration {
	wss: WebSocketServer;

	constructor(server: http.Server) {
		// TODO: save with keycloak
		this.wss = new WebSocketServer({ server });
	}

	sendMessage(msg: any) {
		for (const client of this.wss.clients) {
			client.send(JSON.stringify(msg));
		}
	}
}
