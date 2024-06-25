import ws from 'ws';
import http from 'http';

export class WebSocketConfiguration {
	wss: ws.Server;

	constructor(server: http.Server) {
		this.wss = new ws.Server({ server });
	}

	sendMessage(msg: any) {
		for (const client of this.wss.clients) {
			client.send(JSON.stringify(msg));
		}
	}
}
