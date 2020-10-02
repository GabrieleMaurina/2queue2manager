const fs = require('fs')
const mc = require('minecraft-protocol')
const tokens = require('prismarine-tokens-fixed');

const options = {
	host: '2b2t.org',
	port: 25565,
	version: '1.12.2',
	tokensLocation: './minecraft_token.json',
	tokensDebug: false
}

const o = console.log

function main(){
	connect()
}

function connect(){
	fs.readFile('secrets.json', (err, data)=>{
		if(err) throw err
		const user = JSON.parse(data)
		options.username = user.email
		options.password = user.password
		tokens.use(options, (err, opts)=>{
			client = mc.createClient(opts)
			server = createServer(client)
			join(client)
		})
	})
}

function join(client){
	client.on("packet", (data, meta)=>{
		switch (meta.name) {
			case "playerlist_header":
				if (!finishedQueue && config.minecraftserver.is2b2t) { // if the packet contains the player list, we can use it to see our place in the queue
					let headermessage = JSON.parse(data.header);
					let positioninqueue = headermessage.text.split("\n")[5].substring(25);
					webserver.queuePlace = positioninqueue; // update info on the web page
					if (webserver.queuePlace !== "None" && lastQueuePlace !== webserver.queuePlace) {
						if (!totalWaitTime) {
							totalWaitTime = Math.pow(positioninqueue / 35.4, 2 / 3);
						}
						timepassed = -Math.pow(positioninqueue / 35.4, 2 / 3) + totalWaitTime;
						ETAhour = totalWaitTime - timepassed;
						webserver.ETA = Math.floor(ETAhour) + "h " + Math.round((ETAhour % 1) * 60) + "m";
						server.motd = `Place in queue: ${positioninqueue} ETA: ${webserver.ETA}`; // set the MOTD because why not
						logActivity("Pos: " + webserver.queuePlace + " ETA: " + webserver.ETA); //set the Discord Activity
						if (config.notification.enabled && webserver.queuePlace <= config.notification.queuePlace && !notisend && config.discordBot && dcUser != null) {
								sendDiscordMsg(dcUser, "Queue", "The queue is almost finished. You are in Position: " + webserver.queuePlace);
							notisend = true;
						}
					}
					lastQueuePlace = webserver.queuePlace;
				}
				break;
			case "chat":
				if (finishedQueue === false) { // we can know if we're about to finish the queue by reading the chat message
					// we need to know if we finished the queue otherwise we crash when we're done, because the queue info is no longer in packets the server sends us.
					let chatMessage = JSON.parse(data.message);
					if (chatMessage.text && chatMessage.text === "Connecting to the server...") {
						if (webserver.restartQueue && proxyClient == null) { //if we have no client connected and we should restart
							stop();
						} else {
							finishedQueue = true;
							webserver.queuePlace = "FINISHED";
							webserver.ETA = "NOW";
							logActivity("Queue is finished");
						}
					}
				}
				break;
			case "respawn":
				Object.assign(loginpacket, data);
				chunkData = new Map();
				break;
			case "login":
				loginpacket = data;
				break;
			case "game_state_change":
				loginpacket.gameMode = data.gameMode;
				break;
		}
		if (proxyClient){
			forwardPacket(data, meta, mcClient);
		}
	});

	client.on('end', () => {
		if (proxyClient) {
			proxyClient.end("Connection reset by 2b2t server.\nReconnecting...");
			proxyClient = null
		}
		stop();
		if (!stoppedByPlayer) log("Connection reset by 2b2t server. Reconnecting...");
		if (config.reconnect.onError) setTimeout(reconnect, 6000);
	});

	client.on('error', (err) => {
		if (proxyClient) {
			proxyClient.end(`Connection error by 2b2t server.\n Error message: ${err}\nReconnecting...`);
			proxyClient = null
		}
		stop();
		log(`Connection error by 2b2t server. Error message: ${err} Reconnecting...`);
		if (config.reconnect.onError) {
			if (err == "Error: Invalid credentials. Invalid username or password.") setTimeout(reconnect, 60000);
			else setTimeout(reconnect, 4000);
		}
	});
}

function createServer(client){
	server = mc.createServer({
		'online-mode': false,
		encryption: true,
		host: '0.0.0.0',
		port: 25565,
		version: 1.12.2,
		'max-players': maxPlayers = 1
	})

	server.on('login', (mcClient) => {
		mcClient.write('login', loginpacket)
		mcClient.write('position', {
			x: 0,
			y: 1.62,
			z: 0,
			yaw: 0,
			pitch: 0,
			flags: 0x00
		})

		mcClient.on('packet', (data, meta) => forwardPacket(data, meta, client))
	});
	return server
}

function forwardPacket(data, meta, dest) {
	if (meta.name !== "keep_alive" && meta.name !== "update_time") {
		dest.write(meta.name, data)
	}
}
