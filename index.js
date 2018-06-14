const crypto = require("crypto");
const http = require("http");
const port = 80;

const requestHandler = (request, response) => {
	console.log(request.url);
	let body = [];

	const hmac = crypto.createHmac("sha1", "OHHAI");

	request.on("data", (chunk) => {
		body.push(chunk);
	}).on("end", () => {
		body = Buffer.concat(body).toString();

		if(!body || !body.toString()) response.end("hi");

		hmac.on("readable", () => {
			const data = hmac.read();
			if (data) {
				const hash = data.toString("hex");
				const matches = "sha1=" + hash === request.headers["x-hub-signature"];
				if(matches){
					const json = JSON.parse(body);
					console.log(json);
					if(json.zen){
						console.log(`Got ping from ${json.repository.html_url} (sender: ${json.sender.login})`);
					}else if(json.pusher){
						console.log(`Got commits from ${json.pusher.name}! ${json.commits.reduce((str, commit) => str + `
${commit.id} ${commit.author.name}: ${commit.message}`)}`);
					}
				}else{
					console.error(`HMAC didn't match! Calculated sha1=${hash}, was sent ${request.headers["x-hub-signature"]}`);
				}
			}
		});


		hmac.write(body);
		hmac.end();
		response.end("hi");
	});
};

const server = http.createServer(requestHandler);

server.listen(port, "0.0.0.0", (err) => {
	if (err) {
		return console.log("something bad happened", err);
	}

	console.log(`server is listening on ${port}`);
});

server.on("request", requestHandler);
